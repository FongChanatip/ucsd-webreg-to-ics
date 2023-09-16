(function(){
    // Write a function to check daylight savings time
    let isDST = (date) => {
        // January is not in DST for sure, so it can be used as a baseline
        const jan = new Date(date.getFullYear(), 0, 1);
        const jul = new Date(date.getFullYear(), 6, 1);
        const stdOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
        
        return date.getTimezoneOffset() < stdOffset;
    }

    // Get end date of quarter in "YYYY-MM-DD" format by prompt()
    let endDateString = prompt("Enter end date of quarter (saturday after week 10) in YYYY-MM-DD format");
    let courseEndDate = new Date(endDateString);
    courseEndDate.setHours(isDST(courseEndDate) ? 7 : 8);

    // Get current quarter
    let currentUrl = window.location.href;
    let quarterCode = currentUrl.substring(currentUrl.indexOf('p1=')+3, currentUrl.indexOf("&"));

    let timestamp = new Date().getTime();

    // Send a get request to api
    fetch(`https://act.ucsd.edu/webreg2/svc/wradapter/secure/get-class?schedname=My+Schedule&final=&sectnum=&termcode=${quarterCode}&_=${timestamp}`)
        .then(response => response.json())
        .then(data => {
            let courses = [];
            for (let i = 0; i < data.length; i++) {
                
                // Check if course is already in courses array
                let course = courses.find(course => (
                    (course.code === data[i].SUBJ_CODE + " " + data[i].CRSE_CODE) && 
                    (course.type === data[i].FK_CDI_INSTR_TYPE) && 
                    (course.startTime[3] === data[i].BEGIN_HH_TIME) &&
                    (course.startTime[4] === data[i].BEGIN_MM_TIME)) && 
                    (course.type != "MI" && course.type != "FI"));

                // If course is not in courses array, add it
                if (!course) {

                    // Calculate duration
                    let start = new Date();
                    start.setHours(data[i].BEGIN_HH_TIME);
                    start.setMinutes(data[i].BEGIN_MM_TIME);
                    let end = new Date();
                    end.setHours(data[i].END_HH_TIME);
                    end.setMinutes(data[i].END_MM_TIME);
                    let difference = Math.abs(start.getTime() - end.getTime()) / 3600000;

                    course = {
                        code: data[i].SUBJ_CODE + " " + data[i].CRSE_CODE,
                        type: data[i].FK_CDI_INSTR_TYPE,
                        startDate: data[i].START_DATE,
                        dayCodes: [data[i].DAY_CODE],
                        startTime: [Number(data[i].START_DATE.substring(0, 4)), Number(data[i].START_DATE.substring(5, 7)), Number(data[i].START_DATE.substring(8, 10)), data[i].BEGIN_HH_TIME, data[i].BEGIN_MM_TIME],
                        endTime: [Number(data[i].START_DATE.substring(0, 4)), Number(data[i].START_DATE.substring(5, 7)), Number(data[i].START_DATE.substring(8, 10)), data[i].END_HH_TIME, data[i].END_MM_TIME],
                        duration: {
                            hours: Math.floor(difference), 
                            minutes: Math.round((difference - Math.floor(difference)) * 60)
                        },
                        location: data[i].BLDG_CODE + " " + data[i].ROOM_CODE,
                    }
                    courses.push(course);
                } else{
                    // If course is already in courses array, add dayCode to dayCodes array

                    // Get index of course in courses array
                    let courseIndex = courses.indexOf(course);
                    courses[courseIndex].dayCodes.push(data[i].DAY_CODE);
                }
            };

            // filter out courses with 0 duration
            courses = courses.filter(course => course.duration.hours !== 0 || course.duration.minutes !== 0);

            // Check if start date corresponds to dayCodes
            courses.forEach(course => {
                let startDate = new Date(course.startDate);
                let startDayCode = startDate.getDay();

                if (!course.dayCodes.includes(startDayCode.toString())) {

                    // Get delta between startDayCode and nextDayCode
                    let delta = course.dayCodes.map(dc => parseInt(dc) > startDayCode ? parseInt(dc) - startDayCode : (parseInt(dc) + 7) - startDayCode).sort((a,b)=>a-b)[0];

                    // Set start date to next day that corresponds to dayCode
                    startDate.setDate(startDate.getDate() + (delta % 7));
                    course.startDate = startDate.toISOString().substring(0, 10);
                    course.startTime[0] = startDate.getFullYear();
                    course.startTime[1] = startDate.getMonth() + 1;
                    course.startTime[2] = startDate.getDate();
                    course.endTime[0] = startDate.getFullYear();
                    course.endTime[1] = startDate.getMonth() + 1;
                    course.endTime[2] = startDate.getDate();
                }

            });
            
            // Create an ICS string
            let icsString = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//UCSD Schedule//EN\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\n";

            // Add the VTIMEZONE definition for America/Los_Angeles
            icsString += `BEGIN:VTIMEZONE\r\nTZID:America/Los_Angeles\r\nBEGIN:DAYLIGHT\r\nTZOFFSETFROM:-0800\r\nTZOFFSETTO:-0700\r\nTZNAME:PDT\r\nDTSTART:19700308T020000\r\nRRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU\r\nEND:DAYLIGHT\r\nBEGIN:STANDARD\r\nTZOFFSETFROM:-0700\r\nTZOFFSETTO:-0800\r\nTZNAME:PST\r\nDTSTART:19701101T020000\r\nRRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU\r\nEND:STANDARD\r\nEND:VTIMEZONE\r\n`;

            courses.forEach(course => {
                let rrule = "";
                if (course.type !== "MI" && course.type !== "FI") {
                    let utcCourseEndDate = new Date(courseEndDate.getTime() + courseEndDate.getTimezoneOffset() * 60000);
                    let untilString = utcCourseEndDate.toISOString().replace(/[-:]/g, '').slice(0, 8) + 'T235959Z';

                    rrule = `RRULE:FREQ=WEEKLY;UNTIL=${untilString};BYDAY=${course.dayCodes.map(dc => ["SU", "MO", "TU", "WE", "TH", "FR", "SA"][dc]).join(",")}\r\n`;
                }

                let eventName = `${course.code} ${course.type}`;
                
                // Remove double spaces
                while (eventName.includes("  ")) {
                    eventName = eventName.replace("  ", " ");
                }

                icsString += "BEGIN:VEVENT\r\n";
                icsString += `UID:${eventName}@ucsd.edu${course.startDate}\r\n`;
                icsString += `SUMMARY:${eventName}\r\n`;
                icsString += `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'}\r\n`;
                icsString += `DTSTART;TZID=America/Los_Angeles:${
                    [
                        course.startTime[0], 
                        course.startTime[1] > 9 ? course.startTime[1] : "0" + course.startTime[1], 
                        course.startTime[2] > 9 ? course.startTime[2] : "0" + course.startTime[2], 
                    ].join("") + "T" + [
                        course.startTime[3] > 9 ? course.startTime[3] : "0" + course.startTime[3], 
                        course.startTime[4] > 9 ? course.startTime[4] : "0" + course.startTime[4], "00"
                    ].join("")
                }\r\n`;
                icsString += `DTEND;TZID=America/Los_Angeles:${
                    [
                        course.endTime[0], 
                        course.endTime[1] > 9 ? course.endTime[1] : "0" + course.endTime[1], 
                        course.endTime[2] > 9 ? course.endTime[2] : "0" + course.endTime[2], 
                    ].join("") + "T" + [
                        course.endTime[3] > 9 ? course.endTime[3] : "0" + course.endTime[3], 
                        course.endTime[4] > 9 ? course.endTime[4] : "0" + course.endTime[4], "00"
                    ].join("")
                }\r\n`;
                icsString += `LOCATION:${course.location}\r\n`;
                icsString += rrule;
                icsString += "END:VEVENT\r\n";
            });

            icsString += "END:VCALENDAR\r\n";

            // Save ICS file
            let blob = new Blob([icsString], {type: "text/calendar"});
            let link = document.createElement("a");
            link.href = window.URL.createObjectURL(blob);
            link.download = `ucsd-${quarterCode}-schedule.ics`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        })
        .catch(err => console.log(err));
})();