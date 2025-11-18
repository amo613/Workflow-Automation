const CALL_FLOW_STORAGE_KEY = 'lastCallFlowId';
const FULL_WORKFLOW_STORAGE_KEY = 'lastFullWorkflowId';

export function getLastCallFlowId() {
  if (
    typeof window === 'undefined' ||
    typeof window.localStorage === 'undefined'
  ) {
    return null;
  }
  return window.localStorage.getItem(CALL_FLOW_STORAGE_KEY);
}

export function setLastCallFlowId(id) {
  if (
    !id ||
    typeof window === 'undefined' ||
    typeof window.localStorage === 'undefined'
  ) {
    return;
  }
  window.localStorage.setItem(CALL_FLOW_STORAGE_KEY, id.toString());
}

export function clearLastCallFlowId() {
  if (
    typeof window === 'undefined' ||
    typeof window.localStorage === 'undefined'
  ) {
    return;
  }
  window.localStorage.removeItem(CALL_FLOW_STORAGE_KEY);
}

export function getLastFullWorkflowId() {
  if (
    typeof window === 'undefined' ||
    typeof window.localStorage === 'undefined'
  ) {
    return null;
  }
  return window.localStorage.getItem(FULL_WORKFLOW_STORAGE_KEY);
}

export function setLastFullWorkflowId(id) {
  if (
    !id ||
    typeof window === 'undefined' ||
    typeof window.localStorage === 'undefined'
  ) {
    return;
  }
  window.localStorage.setItem(FULL_WORKFLOW_STORAGE_KEY, id.toString());
}

export function clearLastFullWorkflowId() {
  if (
    typeof window === 'undefined' ||
    typeof window.localStorage === 'undefined'
  ) {
    return;
  }
  window.localStorage.removeItem(FULL_WORKFLOW_STORAGE_KEY);
}
