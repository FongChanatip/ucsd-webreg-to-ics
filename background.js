chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if(message.action === "fetchSchedule") {
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
          let currentTab = tabs[0]; 
          if(currentTab) {
              chrome.scripting.executeScript({
                  target: {tabId: currentTab.id},
                  files: ['get-schedule.js']
              });
          }
      });
  }
});

chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
      target: {tabId: tab.id},
      files: ['get-schedule.js']
  });
});
