
function doGet()
{
  Logger.log('Serving home page');
  return HtmlService.createHtmlOutputFromFile('index');
}

function create_ra_object(name)
{
  Logger.log("Creating object for RA '" + name + "'");
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
  Logger.log("Call to is_valid_date() with '" + date + "'");
  return date && !isNaN(Date.parse(date));
}

function do_ra_duty_generation(calendar_name, ras_list, start_date_arg,
    end_date_arg, break_start_arg, break_end_arg)
{
  Logger.log("Querying calendars for '" + calendar_name + "'");
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

  Logger.log("Validating dates");

  if(is_valid_date(break_start_arg)) {
    break_start = new Date(break_start_arg);
  }

  if(is_valid_date(break_end_arg)) {
    break_end = new Date(break_end_arg);
  }

  break_dates_set = is_valid_date(break_start_arg) && is_valid_date(break_end_arg);

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

  Logger.log("Checking that the break was not only partially specified");

  if(is_valid_date(break_start_arg) != is_valid_date(break_end_arg)) {
    return JSON.stringify({
      status : false,
      error : "One of the break dates was specified but the other was in invalid",
    });
  }

  Logger.log("Checking that the semester start date is before the end date");

  if(start_date.getTime() > end_date.getTime()) {
    return JSON.stringify({
      status : false,
      error : "The semester start date is after the end date",
    });
  }

  if(break_dates_set) {
    // Check that the break is during semester
    Logger.log("Checking that the break is during the semester");

    if(break_start.getTime() < start_date.getTime()
        || break_start.getTime() > end_date.getTime()
        || break_end.getTime() < start_date.getTime()
        || break_end.getTime() > end_date.getTime()) {
      return JSON.stringify({
        status : false,
        error : "The break is not between the start and end dates",
      });
    }

    Logger.log("Checking that the break starts before it ends");

    if(break_start.getTime() > break_end.getTime()) {
      return JSON.stringify({
        status : false,
        error : "The break start date is after the end date",
      });
    }
  }

  Logger.log("Checking calendar '" + calendar_name + "' exists");
  // Make sure a calendar exists with the given name
  if(calendar_list.length < 1) {
    return JSON.stringify({
      status : false,
      error : "Calendar '" + calendar_name + "' does not exist",
    });
  }

  Logger.log("Getting first calendar in list");
  // Just grab the first calendar with the given name
  cal = calendar_list[0];

  Logger.log("Calculating how many duties should be given");
  // Calculate how many week and weekend duties are needed
  for(var date_iter = new Date(start_date); date_iter <= end_date; date_iter.setDate(date_iter.getDate() + 1)) {
    // Skip days during the break
    if(break_dates_set && date_iter >= break_start && date_iter <= break_end) {
      Logger.log("Day '" + date_iter + "' is during break");
      continue;
    }

    Logger.log("Counting day '" + date_iter + "'");

    if(is_weekend(date_iter))
      dates['weekend'].push(new Date(date_iter));
    else
      dates['week'].push(new Date(date_iter));
  }

	{
		var days = dates['week'].concat(dates['weekend']).sort();

		Logger.log(days.length + " days with duties from " + start_date + " to " + end_date);
		Logger.log("Days in the array: " + JSON.stringify(days));
	}

  // Calculate how many duties each RA gets and the remainder to unfairly assign
  weekend_duties_per_ra = Math.floor(dates['weekend'].length * 2 / ra_objects.length);
  weekend_duties_remainder = dates['weekend'].length * 2 % ra_objects.length;
  week_duties_per_ra = Math.floor(dates['week'].length * 2 / ra_objects.length)
  week_duties_remainder = dates['week'].length * 2 % ra_objects.length;

  Logger.log("Weekends: " + dates['weekend'].length + " (" + weekend_duties_per_ra + " per RA with " + weekend_duties_remainder + " remaining)");
  Logger.log("Weekdays: " + dates['week'].length + " (" + week_duties_per_ra + " per RA with " + week_duties_remainder + " remaining)");
  Logger.log("Assigning duties");

	// Assign duties
	for(var date_type = 0; date_type < date_types.length; ++date_type) {
		// FIXME: Round instead of using this massive line
		var segments = dates[date_types[date_type]].length / ra_objects.length + (dates[date_types[date_type]].length / ra_objects.length > 0);

		for(var segment = 0; segment < segments; ++segment) {
			var available_primary_ras = ra_objects.slice();
			var available_secondary_ras = ra_objects.slice();
			var paired_ras = {};

			while(dates[date_types[date_type]].length > 0 && available_primary_ras.length > 0) {
				var date = dates[date_types[date_type]].shift();
				var primary_index = Math.floor(Math.random() * available_primary_ras.length);
				var primary_ra = available_primary_ras.splice(Math.floor(Math.random() * available_primary_ras.length), 1)[0];
				var valid_available_secondary_ras = available_secondary_ras.filter(function(ra) { return ra != primary_ra && (paired_ras[ra.name] != primary_ra.name || available_primary_ras.length == 0); });
				var secondary_index;
				var secondary_ra;

				secondary_index = Math.floor(Math.random() * valid_available_secondary_ras.length);
				secondary_ra = valid_available_secondary_ras[secondary_index];
				available_secondary_ras.splice(available_secondary_ras.indexOf(secondary_ra), 1);

				Logger.log("Selected RA '" + primary_ra.name + "' for primary on " + date);
				Logger.log("Selected RA '" + secondary_ra.name + "' for seconday on " + date);

				paired_ras[primary_ra.name] = secondary_ra.name;
				cal.createAllDayEvent(primary_ra.name + " / " + secondary_ra.name, date);
				++primary_ra.duty_count['primary'][date_types[date_type]];
				++secondary_ra.duty_count['secondary'][date_types[date_type]];
			}
		}
	}

  Logger.log("Done");

  return JSON.stringify({
    status : true,
    weekend_duties_per_ra : weekend_duties_per_ra,
    weekend_duties_remainder : weekend_duties_remainder,
    week_duties_per_ra : week_duties_per_ra,
    week_duties_remainder : week_duties_remainder,
    ras : ra_objects,
  });
}

