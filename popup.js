document.getElementById('fetchSchedule').addEventListener('click', () => {
    chrome.runtime.sendMessage({action: "fetchSchedule"});
});
