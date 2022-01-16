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

chrome.storage.local.get(["SPACE_ID"], (data) => {
  if (data && data.SPACE_ID) {
    SPACE_ID = data.SPACE_ID;
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
chrome.runtime.onMessage.addListener((request) => {
  if (request.type === "ADD_SPACE_ID") {
    SPACE_ID = request.data.spaceId;
    chrome.storage.local.set({ SPACE_ID: request.data.spaceId });
  }
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
          description: "To activate extenstion click it's icon on any notion page, it will save its workspace id for search",
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
          isNavigableOnly: true,
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
      suggest([{ content: "", description: "Unknow Error. Please check console for details."}]);
    }
  }, DEBOUNCE_TIME)
);

/**
 * Navigate to notion url
 */
chrome.omnibox.onInputEntered.addListener((url) => {
  if (url.startsWith(NOTION_HOST)){
    chrome.tabs.create({ url });
  }
});

/**
 * Notion use both id and uuid format. This function help with convert id to uuid
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
