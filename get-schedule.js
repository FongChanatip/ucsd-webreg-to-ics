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

    // Send a get request to https://act.ucsd.edu/webreg2/svc/wradapter/secure/get-class?schedname=My+Schedule&final=&sectnum=&termcode=${quarterCode}&_=${timestamp}
    // Example response:
    // [{END_MM_TIME	:	50
    // LONG_DESC	:	                              
    // TERM_CODE	:	FA23
    // SECT_CREDIT_HRS	:	4
    // BEGIN_HH_TIME	:	11
    // SECTION_NUMBER	:	231609
    // SUBJ_CODE	:	MATH
    // GRADE_OPTN_CD_PLUS	:	+
    // WT_POS	:	
    // PRIMARY_INSTR_FLAG	:	Y
    // ROOM_CODE	:	106  
    // FK_PCH_INTRL_REFID	:	2170420
    // CRSE_TITLE	:	Intro/Differential Equations  
    // END_HH_TIME	:	11
    // GRADE_OPTION	:	L
    // START_DATE	:	2023-09-28
    // CRSE_CODE	:	 20D 
    // DAY_CODE	:	1
    // BEGIN_MM_TIME	:	0
    // NEED_HEADROW	:	false
    // PERSON_FULL_NAME	:	Ohm, Ko Woon                       
    // FK_SPM_SPCL_MTG_CD	:	  
    // PERSON_ID	:	A17365555
    // BLDG_CODE	:	PCYNH
    // SECT_CREDIT_HRS_PL	:	 
    // SECTION_HEAD	:	231616
    // ENROLL_STATUS	:	EN
    // FK_CDI_INSTR_TYPE	:	LE
    // SECT_CODE	:	B00
    // FK_SEC_SCTN_NUM	:	231616}]



    fetch(`https://act.ucsd.edu/webreg2/svc/wradapter/secure/get-class?schedname=My+Schedule&final=&sectnum=&termcode=${quarterCode}&_=${timestamp}`)
        .then(response => response.json())
        .then(data => {
            let courses = [];
            for (let i = 0; i < data.length; i++) {
                
                // Check if course is already in courses array
                let course = courses.find(course => ((course.code === data[i].SUBJ_CODE + " " + data[i].CRSE_CODE) && (course.type === data[i].FK_CDI_INSTR_TYPE)) && (course.type != "MI" && course.type != "FI"));

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

                    // Day codes:
                    // 1: Monday
                    // 2: Tuesday
                    // 3: Wednesday
                    // 4: Thursday
                    // 5: Friday
                    // 6: Saturday

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

            console.log(icsString);

            // You can then download the ICS file or use it in your application.
            // Example to download the ICS file:
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