/**
 * Transcript Module
 * Handles conversation transcript display
 * React-compatible: Uses callbacks instead of DOM manipulation
 */

export class TranscriptManager {
  constructor(onUpdate) {
    this.currentUserInput = '';
    this.currentAssistantOutput = '';
    this.onUpdate = onUpdate; // Callback: (entries) => void
    this.entries = [];
    this.showTranscript = false;
  }

  addEntry(speaker, text) {
    const entry = {
      speaker,
      text,
      timestamp: new Date().toLocaleTimeString(),
      id: Date.now() + Math.random(),
    };
    this.entries.push(entry);
    if (this.onUpdate) {
      this.onUpdate([...this.entries]);
    }
  }

  updateEntry(speaker, text) {
    const lastEntry = this.entries[this.entries.length - 1];

    if (lastEntry && lastEntry.speaker === speaker) {
      // Update existing entry
      lastEntry.text = text;
      lastEntry.timestamp = new Date().toLocaleTimeString();
    } else {
      // Create new entry
      this.addEntry(speaker, text);
    }
    if (this.onUpdate) {
      this.onUpdate([...this.entries]);
    }
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
    this.showTranscript = true;
    if (this.onUpdate) {
      this.onUpdate([...this.entries]);
    }
  }

  getEntries() {
    return [...this.entries];
  }

  isVisible() {
    return this.showTranscript;
  }
}
