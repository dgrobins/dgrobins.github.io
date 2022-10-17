function _GenerateScheduleTable_test() {
    var x = document.getElementById("schedule").value;
    document.getElementById("schedule_text").innerHTML = x;
}

function init_opt(opt) {
    // initialize options
    opt.debug = 0;

    opt.parse_end = ["", "www.townofcary.org"];  // footer
    opt.hdr = ["Facility", "Start", "End", "Reservation"];

    opt.time_mode = "fixed";  // fixed: based on start/end only.  flex: start/end flex with events
        // event: only shows time for events start/end.
    opt.delta_time = 0.5;
    opt.start_time_str = "08:00 AM";
    //opt.start_time_str = "6:00 PM";
    opt.end_time_str = "10:00 PM";
}

function GenerateScheduleTable() {
    opt = {};
    init_opt(opt);
    //opt.time_mode = document.getElementById("time_selection").value;
    //opt.time_mode = document.getElementsByName("time_selection").value;
    time_modes = document.querySelectorAll('input[name="time_mode"]');
    for (time_mode of time_modes) {
	if (time_mode.checked) {
	    opt.time_mode = time_mode.value;
	}
    }
    //document.getElementById("debug_text").innerHTML = "";
    let text = document.getElementById("schedule").value;
    //document.getElementById("debug_text").innerHTML += "DEBUG1: " + text + "<br>";
    let lines = "";
    lines = text.split(/\r?\n/);
    //tbr:document.getElementById("debug_text").innerHTML += "DEBUG2: " + lines + "<br>";

    EVENT_TABLE = [];  // list()
    TIME_TABLE = [];  // list()

    parse_text(opt, lines, EVENT_TABLE);
    //console.log("text:", text);

    build_table(opt, TIME_TABLE);
    //hdr_list = ["Start", "End"];
    hdr_list = ["Time"];
    hdr_list = hdr_list.concat(FACILITY_LIST);
    table_text = gen_html_table(hdr_list, TIME_TABLE);
    //html_text += "This is an override test";
    //tbr:document.getElementById("debug_text").innerHTML += "DEBUG3:" + html_text + "<br>";
    let reservation_text = gen_html_reservation(RESERVATION_LIST);
    schedule_text = table_text + reservation_text;
    document.getElementById("schedule_text").innerHTML = schedule_text;
}  // GenerateScheduleTable()

function parse_text(opt, lines, EVENT_TABLE) {
    // parse header
    if (lines.length == 0) {
	console.log("ERROR: file is empty");
	process.exit(1);
    }
    let start_hdr = 0;
    let hdr_col = 0;
    let hdr = [];
    let active_row = [];
    let active_col = 0;
    let got_end = 0;

    const num_cols = opt.hdr.length;
    for (let i_line = 0; i_line < lines.length; i_line++) {
	let line = lines[i_line];
	line = line.trim();
	if (opt.debug)
	    console.log("line %d: [%s]", i_line, line);	
	if (!start_hdr) {
	    // look for header
	    if (line == opt.hdr[hdr_col]) {
		start_hdr = 1;
		hdr_col++;
	    }
	} else if (start_hdr && hdr_col < num_cols) {
	    // parse header
	    if (line !== opt.hdr[hdr_col]) {
		console.error("ERROR: header mismatch on col=%d: expect:%s actual:%s", hdr_col, opt.hdr[hdr_col], line);
		process.exit(1);
	    }
	    hdr_col++;
	} else if (start_hdr && !got_end) {
	    // parse body
	    if (line === opt.parse_end[0] || line === opt.parse_end[1]) {
		// look for body end
		got_end = 1;
		continue;
	    } else {
		// reformat facility: replace "Youth/Pickleball" => "Youth / Pickleball"
		if (opt.hdr[active_col] == "Facility") {
		    line = line.replace("/", " / ");
		}
		active_row.push(line);
		active_col++;
		if (active_col == num_cols) {
		    EVENT_TABLE.push(active_row);
		    active_row = [];
		    active_col = 0;
		}
	    }
	}
    }
    if (!start_hdr) {
	console.error("ERROR: header not found");
	process.exit(1);
    }
    if (EVENT_TABLE.length == 0) {
	console.error("ERROR: no body found");
	process.exit(1);
    }
}  // end parse_text()

function build_table(opt, TIME_TABLE) {
    // build facility array from EVENT_TABLE:
    // find earliest start_time and latest end_time
    let min_start_time = -1;
    let max_end_time = -1;
    let FACILITY_MAP = {};  // dict()
    let RESERVATION_MAP = {};  //dict()
    
    for (let i = 0; i < EVENT_TABLE.length; i++) {
	event = EVENT_TABLE[i];
	facility = event[0];
	FACILITY_MAP[facility] = 1;
	reservation = event[3];
	RESERVATION_MAP[reservation] = 1;

	// look for min start time
	start_time_str = event[1];
	start_time = convert_time_str2num(start_time_str);
	if (min_start_time == -1 || start_time < min_start_time) {
	    // console.log("DEBUG: update min_start_time: start_time=%f min_start_time=%f", start_time, min_start_time);
	    min_start_time = start_time;
	}
	// look for max end time
	end_time_str = event[2];
	end_time = convert_time_str2num(end_time_str);
	if (max_end_time == -1 || end_time > max_end_time)
	    max_end_time = end_time;
    }  //endfor

    //create FAILITY_LIST and map from FACILITY_MAP
    FACILITY_LIST = Object.keys(FACILITY_MAP);
    //console.log(FACILITY_LIST);
    FACILITY_LIST.sort(function compareFn(a,b) {
	if (a.includes("Youth") && !b.includes("Youth")) {
	    return 1;
	} else if (!a.includes("Youth") && b.includes("Youth")) {
	    return -1;
	} else {
	    if (a < b) return -1;
	    else if (a > b) return 1;
	    else return 0;
	}
    });
    //console.log(FACILITY_LIST);
    //process.exit(1);
    for (let i = 0; i < FACILITY_LIST.length; i++) {
	FACILITY_MAP[FACILITY_LIST[i]] = i;
    }
    // create reservation_list and map from RESERVATION_MAP
    RESERVATION_LIST = Object.keys(RESERVATION_MAP);
    RESERVATION_LIST.sort();
    for (let i = 0; i < RESERVATION_LIST.length; i++) {
	RESERVATION_MAP[RESERVATION_LIST[i]] = i;
    }
    
    // init time_table (indexed by time)
    // set default for fixed/flex
    start_time = convert_time_str2num(opt.start_time_str);
    end_time = convert_time_str2num(opt.end_time_str);
    if (opt.time_mode == "event") {
	// override for event
	start_time = min_start_time;
	end_time = max_end_time;
    } else if (opt.time_mode == "flex"){
	// flex to cover all event times
	if (min_start_time < start_time) start_time = min_start_time;
	if (max_end_time > end_time) end_time = max_end_time;
    }
    time = start_time;
    while (time < end_time) {
	time_row = [];
	time_row.push(time);  // start_time
	// increment for end time, and loop later
	time += opt.delta_time;
//	time_row.push(time)  // end_time
	// populate empty slots, later fill in as available (or even on print_table)
	for (let i = 0; i < FACILITY_LIST.length; i++) {
	    time_row.push("");
	}
	TIME_TABLE.push(time_row);
    }  // endwhile

    // file in table from event
    first_row_start_time = TIME_TABLE[0][0];
    for (let i = 0; i < EVENT_TABLE.length; i++) {
	event = EVENT_TABLE[i];
	facility = event[0];
	start_str = event[1];
	end_str = event[2];
	reservation = event[3];
	start_time = convert_time_str2num(start_str);
	end_time = convert_time_str2num(end_str);
	time = start_time;
	col = FACILITY_MAP[facility] + 1;
	res_id = RESERVATION_MAP[reservation];
	while (time < end_time) {
	    row = Math.floor((time - first_row_start_time) * 2);
	    if (row >= 0 && row < TIME_TABLE.length)
		TIME_TABLE[row][col] = res_id;
	    // increment
	    time += 0.5;
	}  //endwhile
    }  //endfor
}  // end build_table()

function convert_time_str2num(time_str) {
    // convert string of format: "dd:dd {AM,PM}" to 24hr.hr_fraction
    const re = /(\d\d*):(\d\d) (AM|PM)/;
    const group = time_str.match(re);
    if (!group) {
	console.error("ERROR: invalid time string (expect HH:MM AM/PM): actual:[%s]", time_str);
	process.exit(1);
    }
    //console.log(group); process.exit(1);
    hour_str = group[1];
    min_str = group[2];
    ampm = group[3];
    time_num = parseInt(hour_str) % 12;
    time_num += (parseInt(min_str) / 60.0);
    if (ampm == 'PM')
	time_num += 12;
    return time_num;
}  // end convert_time_str2num()

function convert_time_num2str(time) {
    // convert 24hr.hr_fraction to string of format: "dd:dd {AM,PM}"
    //console.log(group); process.exit(1);
    hour = Math.floor(time) % 12;
    if (hour == 0) hour = 12;
    min = Math.round(60 * (time - Math.floor(time)));
    min_str = "" + min;
    if (min_str.length == 1) min_str = "0" + min_str;
    ampm_str = time >= 12.0 ? "pm" : "am";
    //time_str = hour + ":" + min_str + " " + ampm_str;
    time_str = hour + ":" + min_str + "&nbsp;" + ampm_str;
    //return time;
    return time_str;
}  // end convert_time_num2str()

function gen_html_table(hdr, table) {
    output = "<h2>Time Table:</h2>";
    output += '<table class="time_table">';
    // generate table header
    output += "<tr>";
    hdr.forEach(elem => {
	output += '<th class="time_table">' + elem + "</th>\n";
    });
    // generate table body
    for (let i_row = 0; i_row < table.length; i_row++) {
	row = table[i_row];
	output += "<tr>";
	for (let i_col = 0; i_col < row.length; i_col++) {
	    col = row[i_col];
	    if (i_col == 0) {
		time = convert_time_num2str(col)
		output += '<th class="time_table">' + time + "</th>";
	    } else {
		output += '<td class="time_table">' + col + "</td>";
	    }
	}
	output += "</tr>\n";
    }
    output += "</table>";
    return output;
}  //end gen_html_table()

function gen_html_reservation(RESERVATION_LIST) {
    let entry;
/*    output = '<p class="res_entry">';
    for (let i = 0; i < RESERVATION_LIST.length; i++) {
	entry = i + " - " + RESERVATION_LIST[i] + "<br>";
	output += entry;
    }
    output += "</p>";
*/
    output = "<h2>Reservation List:</h2>"
    output += '<table res_table>';
    for (let i = 0; i < RESERVATION_LIST.length; i++) {
	entry = '<tr><td class="res_table">';
	entry += i + " - " + RESERVATION_LIST[i] + "</td></tr>";
	output += entry;
    }
    output += '</table>'
    return output;
}  // end gen_html_reservation()
