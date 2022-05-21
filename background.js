const NOTION_HOST = "https://www.notion.so";
const NOTION_SEARCH_URL = `${NOTION_HOST}/api/v3/search`;
const SUGGEST_PREFIX = "Notion";
/**
 * Min Char count to start search
 */
const MIN_SEARCH_LENGTH = 1;
/**
 * Suggest debounce time to prevent search on each keyup/down
 */
const DEBOUNCE_TIME = 150;
/**
 * Notion api return matched text inside this tag name <gzkNfoUU>searced</gzkNfoUU>. Later we replace it with <match>searced</match> tag
 */
const STRANGE_NOTION_TAG = "gzkNfoUU";


/**
 * Notion workspace ID, based on cookie ajs_group_id. Its' called space id in search term.
 */
let SPACE_ID;
/**
 * Search title only, used for large notions
 */
let TITLE_ONLY = false;
/**
 * Open in same tab or new flag
 */
let OPEN_IN_NEW_TAB = true;

chrome.storage.local.get(["SPACE_ID", "TITLE_ONLY", "OPEN_IN_NEW_TAB"], (data) => {
  if (data && data.SPACE_ID) {
    SPACE_ID = data.SPACE_ID;
  }
  if (data && data.TITLE_ONLY) {
    TITLE_ONLY = data.TITLE_ONLY;
  }
  if (data && data.OPEN_IN_NEW_TAB) {
    OPEN_IN_NEW_TAB = data.OPEN_IN_NEW_TAB;
  }
});

/**
 * Get a cookie with workspace id from notion. This ID is required for search
 */
chrome.browserAction.onClicked.addListener((tab) => {
  chrome.tabs.executeScript({
    file: 'content.js'
  });
});

/**
 * Saving workspace id for future use
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "ADD_SPACE_ID") {
    SPACE_ID = request.data.spaceId;
    chrome.storage.local.set({ SPACE_ID: request.data.spaceId });
  } else if (request.type === "SETTINGS"){
    TITLE_ONLY = request.data.TITLE_ONLY;
    OPEN_IN_NEW_TAB = request.data.OPEN_IN_NEW_TAB;
  }
  sendResponse({status: true});
  return true; 
});

chrome.runtime.onInstalled.addListener(function (object) {
  chrome.tabs.create({url: `chrome-extension://${chrome.runtime.id}/options.html`}, function (tab) {
      // console.log("options page opened");
  });
});

/**
 * Suggest logic
 */
chrome.omnibox.onInputChanged.addListener(
  debounce(async (query, suggest) => {
    if (!SPACE_ID) {
      suggest([
        {
          content: NOTION_HOST,
          description: "To activate extension click its icon on any Notion page. It will save its workspace id for search.",
        },
      ]);
      return;
    }

    if (query.length <= MIN_SEARCH_LENGTH) {
      suggest([]);
      return;
    }
    

    try {
      const spaceUUID = idToUuid(SPACE_ID);

      const body = JSON.stringify({
        type: "BlocksInSpace",
        query,
        spaceId: spaceUUID,
        limit: 5,
        filters: {
          isDeletedOnly: false,
          excludeTemplates: false,
          isNavigableOnly: TITLE_ONLY,
          requireEditPermissions: false,
          ancestors: [],
          createdBy: [],
          editedBy: [],
          lastEditedTime: {},
          createdTime: {},
        },
        sort: "Relevance",
        source: "quick_find",
      });
      const response = await fetch(NOTION_SEARCH_URL, {
        method: "POST",
        body,
        headers: {
          "Content-type": "application/json; charset=UTF-8",
        },
      });
      const json = await response.json();

      if (json.results.length === 0){
        suggest([{ content: NOTION_HOST, description: `<dim>${ SUGGEST_PREFIX } - </dim><match>No result. Try different search term.</match>`}]);
        return;
      }

      const prefix = json.recordMap?.space[spaceUUID]?.value?.name || SUGGEST_PREFIX;

      const result = json.results.map((item) => {
        let text = item.highlight?.text || item.highlight?.pathText || "";
        text = text.replaceAll(STRANGE_NOTION_TAG, "match");

        let viewId;
        if (json.recordMap.block[item.id]?.value?.view_ids?.length > 0) {
          viewId = json.recordMap.block[item.id].value.view_ids[0];
        }

        let content = `${NOTION_HOST}/`;
        if (item.isNavigable) {
          content += item.id.replaceAll("-", "");
          if (viewId) {
            content += `?v=${viewId}`;
          }
        } else {
          const itemValue = json.recordMap.block[item.id].value;
          const parentValue = json.recordMap.block[itemValue.parent_id].value;

          content += `${itemValue.parent_id.replaceAll("-", "")}#${item.id.replaceAll("-", "")}`;

          if (!text) {
            text = `<match>${parentValue.properties?.title ? parentValue.properties?.title[0][0] : ""}</match>`;
          }
        }

        return {
          content,
          description: `<dim>${prefix}</dim> - ${text}`,
        };
      });
      suggest(result);
    } catch (err) {
      console.error(err);
      suggest([{ content: "", description: "Unknown Error. Please check console for details."}]);
    }
  }, DEBOUNCE_TIME)
);

/**
 * Navigate to notion url
 */
chrome.omnibox.onInputEntered.addListener((url) => {
  if (url.startsWith(NOTION_HOST)){
    if (OPEN_IN_NEW_TAB){
      chrome.tabs.create({ url });
      return;
    }
    chrome.tabs.update(undefined, { url });
  }
});

/**
 * Notion use both id and uuid format. This function help with converting id to uuid.
 */
function idToUuid(path) {
  return `${path.substr(0, 8)}-${path.substr(8, 4)}-${path.substr(12, 4)}-${path.substr(16, 4)}-${path.substr(20)}`;
}

/**
 * Simple debounce function
 */
function debounce(fn, delay) {
  var timeoutID = null;
  return function () {
    clearTimeout(timeoutID);
    var args = arguments;
    var that = this;
    timeoutID = setTimeout(function () {
      fn.apply(that, args);
    }, delay);
  };
}
