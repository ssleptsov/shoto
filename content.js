let spaceId = localStorage.getItem('ajs_group_id');

try {
  spaceId = JSON.parse(spaceId);
  if (!spaceId){
    alert('Can\'t get Notion workspace id');
  }
} catch (err) {
  alert('Error in getting Notion workspace id');
  console.error('[Content] getting space id error', err);
}

chrome.extension.sendMessage({ type: 'ADD_SPACE_ID', data: { spaceId }}, () => {
  alert(`Notion Space ID added. You can enjoy search within browser search box.`)
});
