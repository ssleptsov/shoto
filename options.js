// Saves options to chrome.storage
function save_options() {
  const OPEN_IN_NEW_TAB = document.getElementById('openInNewTab').checked;
  const TITLE_ONLY = document.getElementById('titleOnly').checked;
  chrome.storage.local.set(
    {
      TITLE_ONLY,
      OPEN_IN_NEW_TAB,
    },
    () => {
      chrome.extension.sendMessage({ type: 'SETTINGS', data: { TITLE_ONLY, OPEN_IN_NEW_TAB} }, () => {
      });
      // Update status to let user know options were saved.
      const status = document.getElementById('status');
      status.textContent = 'Options saved.';
      setTimeout(() => {
        status.textContent = '';
      }, 750);
    }
  );
}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
function restore_options() {
  // Use default value color = 'red' and likesColor = true.
  chrome.storage.local.get(["SPACE_ID", "TITLE_ONLY", "OPEN_IN_NEW_TAB"],
    (data) => {
      document.getElementById('openInNewTab').checked = data.OPEN_IN_NEW_TAB ? data.OPEN_IN_NEW_TAB : true;
      document.getElementById('titleOnly').checked = data.TITLE_ONLY;
      if (!data.SPACE_ID){
        document.getElementById('notActive').style.display = 'block';
      } else {
        document.getElementById('active').style.display = 'block';
      }
    }
  );
}

/**
 * Saving workspace id for future use
 */
 chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "ADD_SPACE_ID") {
    document.getElementById('notActive').style.display = 'none';
    document.getElementById('active').style.display = 'none';
    if (!request.data.spaceId){
      document.getElementById('notActive').style.display = 'block';
    } else {
      document.getElementById('active').style.display = 'block';
    }
  }
  sendResponse({status: true});
  return true; 
});

document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('save').addEventListener('click', save_options);
