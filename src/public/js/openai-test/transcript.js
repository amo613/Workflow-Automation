/**
 * Transcript Module
 * Handles conversation transcript display
 */

export class TranscriptManager {
  constructor() {
    this.currentUserInput = '';
    this.currentAssistantOutput = '';
  }

  addEntry(speaker, text) {
    const transcriptContent = document.getElementById('transcriptContent');
    if (!transcriptContent) return;

    const entry = document.createElement('div');
    entry.className = `transcript-entry ${speaker}`;

    const label = document.createElement('div');
    label.className = 'label';
    label.textContent = speaker === 'user' ? '👤 You' : '🤖 Assistant';

    const textDiv = document.createElement('div');
    textDiv.className = 'text';
    textDiv.textContent = text;

    const timestamp = document.createElement('div');
    timestamp.className = 'timestamp';
    timestamp.textContent = new Date().toLocaleTimeString();

    entry.appendChild(label);
    entry.appendChild(textDiv);
    entry.appendChild(timestamp);
    transcriptContent.appendChild(entry);
    transcriptContent.scrollTop = transcriptContent.scrollHeight;
  }

  updateEntry(speaker, text) {
    const transcriptContent = document.getElementById('transcriptContent');
    if (!transcriptContent) return;

    const entries = transcriptContent.querySelectorAll('.transcript-entry');
    const lastEntry = entries[entries.length - 1];

    if (lastEntry && lastEntry.classList.contains(speaker)) {
      // Update existing entry
      const textDiv = lastEntry.querySelector('.text');
      if (textDiv) {
        textDiv.textContent = text;
      }
    } else {
      // Create new entry
      this.addEntry(speaker, text);
    }
    transcriptContent.scrollTop = transcriptContent.scrollHeight;
  }

  updateUserInput(text) {
    this.currentUserInput = text;
    this.updateEntry('user', text);
  }

  addUserInput(text) {
    this.currentUserInput = text;
    this.addEntry('user', text);
    this.currentUserInput = ''; // Reset for next input
  }

  updateAssistantOutput(text) {
    this.currentAssistantOutput = text;
    this.updateEntry('assistant', text);
  }

  addAssistantOutput(text) {
    this.currentAssistantOutput = text;
    this.addEntry('assistant', text);
    this.currentAssistantOutput = ''; // Reset for next response
  }

  resetAssistant() {
    this.currentAssistantOutput = '';
  }

  resetUser() {
    this.currentUserInput = '';
  }

  show() {
    const transcriptSection = document.getElementById('transcriptSection');
    if (transcriptSection) {
      transcriptSection.style.display = 'block';
    }
  }
}
