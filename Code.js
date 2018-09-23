
function debug_do_ra_duty_generation()
{
	var start = '2019-01-18';
	var end = '2019-05-11';
	var break_start = '2019-03-09';
	var break_end = '2019-03-17';
	var ra_list = [
		'RA 01',
		'RA 02',
		'RA 03',
		'RA 04',
		'RA 05',
		'RA 06',
		'RA 07',
		'RA 08',
		'RA 09',
		'RA 10',
		'RA 11',
		'RA 12',
		'RA 13',
		'RA 14',
		'RA 15',
		'RA 16',
		'RA 17',
		'RA 20',
		'RA 21',
		'RA 22',
		'RA 23',
		'RA 24'
	].join('\n');

	var ret = do_ra_duty_generation('RA Test', ra_list, start, end, break_start, break_end);

	ret;
}

function doGet()
{
	console.log('Serving home page');
	return HtmlService.createHtmlOutputFromFile('index');
}

function create_ra_object(name)
{
	console.log("Creating object for RA '" + name + "'");
	return {
		name: name,
		duty_count: {
			'primary': {
				'week': 0,
				'weekend': 0
			},
			'secondary': {
				'week': 0,
				'weekend': 0
			}
		}
	};
}

function is_weekend(date)
{
	// Thursday, Friday and Saturday are 4, 5 and 6
	return date.getDay() >= 4;
}

function is_valid_date(date)
{
	console.log("Call to is_valid_date() with '" + date + "'");
	return date && !isNaN(Date.parse(date));
}

function create_duty_object(date, ras)
{
	return {
		date : new Date(date),
		ras : ras.slice(0),
	};
}

var seed = 1;

function random() {
	var x = Math.sin(seed++) * 10000;
	return x - Math.floor(x);
}

function do_ra_duty_generation(calendar_name, ras_list, start_date_arg,
		end_date_arg, break_start_arg, break_end_arg)
{
	seed = Math.floor(Math.random() * 2147483647);
	console.log("Seeding the PRNG: " + seed);
	console.log("Querying calendars for '" + calendar_name + "'");
	var calendar_list = CalendarApp.getCalendarsByName(calendar_name);
	var ra_objects = ras_list.split('\n').map(create_ra_object);
	var cal = null;

	var date_types = ['week', 'weekend'];
	var dates = {
		'week': [],
		'weekend': []
	};
	var week_duties_per_ra = 0;
	var weekend_duties_per_ra = 0;
	var week_duties_remainder = 0;
	var weekend_duties_remainder = 0;
	var remaining_duties = 0;
	var break_dates_set;

	var start_date = null;
	var end_date = null;
	var break_start = null;
	var break_end = null;

	var final_duties = [];

	console.info("Validating dates");

	if(is_valid_date(break_start_arg)) {
		break_start = new Date(break_start_arg);
	}

	if(is_valid_date(break_end_arg)) {
		break_end = new Date(break_end_arg);
	}

	break_dates_set = is_valid_date(break_start_arg)
			&& is_valid_date(break_end_arg);

	if(!is_valid_date(start_date_arg)) {
		return JSON.stringify({
			status : false,
			error : "The start date was invalid",
		});
	} else {
		start_date = new Date(start_date_arg);
	}

	if(!is_valid_date(end_date_arg)) {
		return JSON.stringify({
			status : false,
			error : "The end date was invalid",
		});
	} else {
		end_date = new Date(end_date_arg);
	}

	console.log("Checking that the break was not only partially specified");

	if(is_valid_date(break_start_arg) != is_valid_date(break_end_arg)) {
		return JSON.stringify({
			status : false,
			error : "One of the break dates was specified but the other was in invalid",
		});
	}

	console.log("Checking that the semester start date is before the end date");

	if(start_date.getTime() > end_date.getTime()) {
		return JSON.stringify({
			status : false,
			error : "The semester start date is after the end date",
		});
	}

	if(break_dates_set) {
		// Check that the break is during semester
		console.log("Checking that the break is during the semester");

		if(break_start.getTime() < start_date.getTime()
				|| break_start.getTime() > end_date.getTime()
				|| break_end.getTime() < start_date.getTime()
				|| break_end.getTime() > end_date.getTime()) {
			return JSON.stringify({
				status : false,
				error : "The break is not between the start and end dates",
			});
		}

		console.log("Checking that the break starts before it ends");

		if(break_start.getTime() > break_end.getTime()) {
			return JSON.stringify({
				status : false,
				error : "The break start date is after the end date",
			});
		}
	}

	console.log("Checking calendar '" + calendar_name + "' exists");
	// Make sure a calendar exists with the given name
	if(calendar_list.length < 1) {
		return JSON.stringify({
			status : false,
			error : "Calendar '" + calendar_name + "' does not exist",
		});
	}

	console.log("Getting first calendar in list");
	// Just grab the first calendar with the given name
	cal = calendar_list[0];

	console.info("Calculating how many duties should be given");
	// Calculate how many week and weekend duties are needed
	for(var date_iter = new Date(start_date); date_iter <= end_date;
			date_iter.setDate(date_iter.getDate() + 1)) {
		// Skip days during the break
		if(break_dates_set && date_iter >= break_start
				&& date_iter <= break_end) {
			console.log("Day '" + date_iter + "' is during break");
			continue;
		}

		console.log("Counting day '" + date_iter + "'");

		if(is_weekend(date_iter))
			dates['weekend'].push(new Date(date_iter));
		else
			dates['week'].push(new Date(date_iter));
	}

	{
		var days = dates['week'].concat(dates['weekend']).sort();

		console.log(days.length + " days with duties from " + start_date + " to "
				+ end_date);
		console.log("Days in the array: " + JSON.stringify(days));
	}

	/*
	 * Calculate how many duties each RA should get and the how many
	 * remain to unfairly assign among them.
	 */
	weekend_duties_per_ra = Math.floor(dates['weekend'].length * 2
			/ ra_objects.length);
	weekend_duties_remainder = dates['weekend'].length * 2 % ra_objects.length;
	week_duties_per_ra = Math.floor(dates['week'].length * 2 / ra_objects.length)
	week_duties_remainder = dates['week'].length * 2 % ra_objects.length;

	console.log("Weekends: " + dates['weekend'].length + " ("
			+ weekend_duties_per_ra + " per RA with " + weekend_duties_remainder
			+ " remaining)");
	console.log("Weekdays: " + dates['week'].length + " (" + week_duties_per_ra
			+ " per RA with " + week_duties_remainder + " remaining)");
	console.info("Assigning duties");

	// Assign duties
	for(var date_type = 0; date_type < date_types.length; ++date_type) {
		var segments = Math.ceil(dates[date_types[date_type]].length
				/ ra_objects.length);

		console.log("Segments for date type '" + date_types[date_type] + "': "
				+ segments);

		for(var segment = 0; segment < segments; ++segment) {
			var avail_primary_ras = ra_objects.slice();
			var avail_secondary_ras = ra_objects.slice();
			var paired_ras = {};

			console.log("Assigning for '" + date_types[date_type] + "' segment "
					+ segment);

			while(dates[date_types[date_type]].length > 0
					&& avail_primary_ras.length > 0) {
				var date = dates[date_types[date_type]].shift();
				var primary_index = Math.floor(random() * avail_primary_ras.length);
				var primary_ra = avail_primary_ras.splice(Math.floor(random()
						* avail_primary_ras.length), 1)[0];
				var valid_avail_secondary_ras =
						avail_secondary_ras.filter(function(ra) {
							return ra != primary_ra && (paired_ras[ra.name] != primary_ra.name
									|| avail_primary_ras.length == 0);
						});
				var secondary_index;
				var secondary_ra;

				secondary_index = Math.floor(random()
						* valid_avail_secondary_ras.length);
				console.log("Selected secondary RA index " + secondary_index
						+ " out of " + valid_avail_secondary_ras.length
						+ " total valid availible secondary RAs");
				secondary_ra = valid_avail_secondary_ras[secondary_index];
				avail_secondary_ras.splice(avail_secondary_ras.indexOf(secondary_ra),
						1);

				console.log("Selected RA '" + primary_ra.name + "' for primary on "
						+ date);
				console.log("Selected RA '" + secondary_ra.name + "' for seconday on "
						+ date);

				paired_ras[primary_ra.name] = secondary_ra.name;
				final_duties.push(create_duty_object(date,
						[primary_ra.name, secondary_ra.name]));
				++primary_ra.duty_count['primary'][date_types[date_type]];
				++secondary_ra.duty_count['secondary'][date_types[date_type]];
			}
		}
	}

	console.time("Time before API flood error");

	for(var duty_iter = 0; duty_iter < final_duties.length; ++duty_iter)
	{
		var event_created = false;

		do {
			try {
				cal.createAllDayEvent(final_duties[duty_iter].ras.join(' / '),
						final_duties[duty_iter].date);
				event_created = true;
			} catch(e) {
				console.timeEnd("Time before API flood error");
				console.warn(e);
				console.log("Caught error on iteration " + duty_iter);
				Utilities.sleep(1000);
				console.time("Time before API flood error");
			}
		} while (!event_created);
	}

	console.timeEnd("Time before API flood error");
	console.info("Done");

	return JSON.stringify({
		status : true,
		weekend_duties_per_ra : weekend_duties_per_ra,
		weekend_duties_remainder : weekend_duties_remainder,
		week_duties_per_ra : week_duties_per_ra,
		week_duties_remainder : week_duties_remainder,
		ras : ra_objects,
	});
}

