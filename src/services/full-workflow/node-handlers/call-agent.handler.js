import { resolveTemplate } from '#utils/template-engine.js';
import logger from '#config/logger.js';
import { createJob } from '#services/jobs.service.js';
import { getWorkflow } from '#services/workflow.service.js';
import { compileWorkflowToPrompt } from '#utils/workflow-compiler.utils.js';
import { db } from '#config/database.js';
import { knowledgeBaseEntries } from '#models/knowledge-base.model.js';
import { eq, inArray, and } from 'drizzle-orm';

// Call Agent Node: Triggert einen Anruf über das BullMQ Job-System
export async function executeCallAgent(data, context) {
  logger.info('Call Agent Node executing', {
    dataKeys: Object.keys(data),
    hasKnowledgeBaseIds: !!data.knowledge_base_ids,
    knowledgeBaseIds: data.knowledge_base_ids,
    knowledgeBaseIdsType: typeof data.knowledge_base_ids,
    knowledgeBaseIdsIsArray: Array.isArray(data.knowledge_base_ids),
  });

  const {
    use_existing,
    workflow_id,
    prompt,
    voice = 'alloy',
    phone_number,
    knowledge_base_ids = [],
    temperature = 1.0,
    instructions = 'You are a helpful voice assistant. Keep responses brief, natural, and conversational.',
    max_response_output_tokens = 4096,
    vad_threshold = 0.5,
    tool_choice = 'auto',
  } = data;

  const kbIds = Array.isArray(knowledge_base_ids)
    ? knowledge_base_ids
    : knowledge_base_ids
      ? [knowledge_base_ids]
      : [];

  logger.info('Call Agent Node data parsed', {
    hasPhoneNumber: !!phone_number,
    hasKnowledgeBaseIds: kbIds.length > 0,
    knowledgeBaseIds: kbIds,
    useExisting: use_existing,
    hasWorkflowId: !!workflow_id,
    hasPrompt: !!prompt,
  });

  if (!phone_number) {
    throw new Error('Phone number is required');
  }

  // Resolve phone number template
  const resolvedPhoneNumber = resolveTemplate(phone_number, context);

  let callPrompt = '';

  if (use_existing && workflow_id) {
    try {
      const userId = context.userId || context.workflowInput?.userId;
      if (!userId) {
        throw new Error('User ID not found in context');
      }

      const workflow = await getWorkflow(workflow_id, userId);
      if (workflow && workflow.graph_json) {
        callPrompt = compileWorkflowToPrompt(workflow.graph_json);

        // Alte Knowledge Base aus Workflow-Prompt entfernen, wenn neue Einträge ausgewählt sind
        if (kbIds && kbIds.length > 0) {
          const kbSectionRegex =
            /\n\nKNOWLEDGE BASE:[\s\S]*?(?=\n\n(?:[A-Z][A-Z_ ]+:|$))/;
          const beforeRemoval = callPrompt.length;
          callPrompt = callPrompt.replace(kbSectionRegex, '');

          logger.info('Removed old knowledge base from workflow prompt', {
            workflowId: workflow_id,
            promptLengthBeforeRemoval: beforeRemoval,
            promptLengthAfterRemoval: callPrompt.length,
            removed: beforeRemoval !== callPrompt.length,
          });
        }

        logger.info('Loaded call flow workflow', {
          workflowId: workflow_id,
          promptLength: callPrompt.length,
        });
      } else {
        throw new Error('Workflow not found or has no graph_json');
      }
    } catch (error) {
      logger.error('Failed to load call flow workflow', {
        workflowId: workflow_id,
        error: error.message,
      });
      throw error;
    }
  } else if (prompt) {
    callPrompt = resolveTemplate(prompt, context);
  } else {
    throw new Error('Either workflow_id or prompt is required');
  }

  // Knowledge Base Einträge laden und in Prompt integrieren
  let knowledgeBaseText = '';
  if (kbIds && kbIds.length > 0) {
    try {
      const userId = context.userId || context.workflowInput?.userId;
      if (!userId) {
        logger.warn(
          'User ID not found in context, skipping knowledge base integration'
        );
      } else {
        const entries = await db
          .select()
          .from(knowledgeBaseEntries)
          .where(
            and(
              eq(knowledgeBaseEntries.user_id, userId),
              inArray(knowledgeBaseEntries.id, kbIds)
            )
          );

        logger.info('Knowledge base query executed', {
          userId,
          requestedIds: kbIds,
          foundEntries: entries.length,
          entryDetails: entries.map(e => ({
            id: e.id,
            name: e.name || 'N/A',
            textLength: e.text?.length || 0,
            textPreview: e.text?.substring(0, 100) || 'N/A',
          })),
          allEntryFields: entries.length > 0 ? Object.keys(entries[0]) : [],
        });

        if (entries.length > 0) {
          knowledgeBaseText = entries
            .map(entry => `**${entry.name}**:\n${entry.text}`)
            .join('\n\n');

          logger.info('Loaded knowledge base entries for call', {
            entryCount: entries.length,
            entryIds: kbIds,
            knowledgeBaseTextLength: knowledgeBaseText.length,
            knowledgeBaseTextPreview: knowledgeBaseText.substring(0, 300),
            entryNames: entries.map(e => e.name || 'N/A'),
            entryTexts: entries.map(e => (e.text || '').substring(0, 50)),
          });
        } else {
          logger.warn('No knowledge base entries found for requested IDs', {
            userId,
            requestedIds: kbIds,
            entryDetails: entries.map(e => ({
              id: e.id,
              name: e.name,
              text: e.text?.substring(0, 50),
            })),
          });
        }
      }
    } catch (error) {
      logger.error('Failed to load knowledge base entries', {
        error: error.message,
        stack: error.stack,
        knowledgeBaseIds: kbIds,
      });
    }
  }

  // Knowledge Base in Prompt integrieren
  if (knowledgeBaseText) {
    callPrompt = `${callPrompt}

KNOWLEDGE BASE:
${knowledgeBaseText}`;

    logger.info('Knowledge base integrated into prompt', {
      knowledgeBaseLength: knowledgeBaseText.length,
      knowledgeBasePreview: knowledgeBaseText.substring(0, 200),
      totalPromptLength: callPrompt.length,
    });
  } else {
    logger.info('No knowledge base entries to integrate', {
      knowledgeBaseIds: kbIds,
      hasKnowledgeBaseIds: kbIds.length > 0,
    });
  }

  logger.info('Final call prompt prepared', {
    promptLength: callPrompt.length,
    promptPreview: callPrompt.substring(0, 300),
    hasKnowledgeBase: !!knowledgeBaseText,
  });

  // Phone Call Job erstellen
  try {
    const userId = context.userId || context.workflowInput?.userId;

    const job = await createJob(
      'phone-call',
      {
        toNumber: resolvedPhoneNumber,
        config: {
          voice,
          prompt: callPrompt,
          temperature: parseFloat(temperature) || 1.0,
          instructions:
            instructions ||
            'You are a helpful voice assistant. Keep responses brief, natural, and conversational.',
          max_response_output_tokens:
            parseInt(max_response_output_tokens) || 4096,
          vad_threshold: parseFloat(vad_threshold) || 0.5,
          tool_choice: tool_choice || 'auto',
        },
      },
      {
        maxAttempts: 3,
        timeout: 300000,
      },
      userId
    );

    logger.info('Phone call job created', {
      jobId: job.id,
      toNumber: resolvedPhoneNumber,
      voice,
    });

    return {
      success: true,
      jobId: job.id,
      toNumber: resolvedPhoneNumber,
      phoneNumber: resolvedPhoneNumber,
      voice,
      status: 'queued',
    };
  } catch (error) {
    logger.error('Failed to create phone call job', {
      error: error.message,
    });
    throw error;
  }
}
