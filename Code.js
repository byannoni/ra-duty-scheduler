
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
    week_primary_duties: 0,
    weekend_primary_duties: 0,
    week_secondary_duties: 0,
    weekend_secondary_duties: 0,
  };
}

function is_weekend(date)
{
  // Thursday, Friday and Saturday are 4, 5 and 6
  return date.getDay() >= 4;
}

function do_ra_duty_generation(calendar_name, ras_list, start_date, end_date, break_start, break_end)
{
  Logger.log("Querying calendars for '" + calendar_name + "'");
  var calendar_list = CalendarApp.getCalendarsByName(calendar_name);
  var ra_objects = ras_list.split('\n').map(create_ra_object);
  var cal = null;
  
  var week_duties = 0;
  var weekend_duties = 0;
  var week_duties_per_ra = 0;
  var weekend_duties_per_ra = 0;
  var week_duties_remainder = 0;
  var weekend_duties_remainder = 0;
  var remaining_duties = 0;
  
  start_date = new Date(start_date);
  end_date = new Date(end_date);
  break_start = new Date(break_start);
  break_end = new Date(break_end);
  
  Logger.log("Validating dates");

  if(isNaN(start_date.getTime()) || isNaN(end_date.getTime()) || isNaN(break_start.getTime()) || isNaN(break_end.getTime())) {
    return JSON.stringify({
      status : false,
      error : "One or more specified dates in invalid",
    });
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
    if(is_weekend(date_iter)) {
      ++weekend_duties;
    } else {
      ++week_duties;
    }
  }

  Logger.log((weekend_duties + week_duties) + " duties from " + start_date + " to " + end_date);
  // Calculate how many duties each RA gets and the remainder to unfairly assign
  weekend_duties_per_ra = Math.floor((weekend_duties) / ra_objects.length);
  weekend_duties_remainder = (weekend_duties) % ra_objects.length;
  week_duties_per_ra = Math.floor((week_duties) / ra_objects.length)
  week_duties_remainder = (week_duties) % ra_objects.length;
  
  Logger.log("Weekend duties: " + weekend_duties + " (" + weekend_duties_per_ra + " per RA with " + weekend_duties_remainder + " remaining)");
  Logger.log("Week duties: " + week_duties + " (" + week_duties_per_ra + " per RA with " + week_duties_remainder + " remaining)");  
  Logger.log("Assigning duties");
  // Assign RAs for each day
  for(var date_iter = start_date; date_iter <= end_date; date_iter.setDate(date_iter.getDate() + 1)) {
    var primary_ra = null;
    var secondary_ra = null;
    
    Logger.log("Processing day " + date_iter);

    do {
      // Select a random RA for primary
      primary_ra = ra_objects[Math.floor(Math.random() * ra_objects.length)];
      
      Logger.log("Considering RA '" + primary_ra.name + "' for primary on " + date_iter);
      
      if(is_weekend(date_iter)) {
        if(primary_ra.weekend_primary_duties < weekend_duties_per_ra || (primary_ra.weekend_primary_duties == weekend_duties_per_ra && weekend_duties_remainder >= weekend_duties)) {
          ++primary_ra.weekend_primary_duties;
          break;
        }
      } else {
        if(primary_ra.week_primary_duties < week_duties_per_ra || (primary_ra.week_primary_duties == week_duties_per_ra && week_duties_remainder >= week_duties)) {
          ++primary_ra.week_primary_duties;
          break;
        }
      }
    } while(true);
    
    Logger.log("Selected RA '" + primary_ra.name + "' for primary on " + date_iter);
    
    do {
      // Select a random RA for secondary
      secondary_ra = ra_objects[Math.floor(Math.random() * ra_objects.length)];

      Logger.log("Considering RA '" + secondary_ra.name + "' for secondary on " + date_iter);
      
      if(secondary_ra != primary_ra) {
        if(is_weekend(date_iter)) {
          if(secondary_ra.weekend_secondary_duties < weekend_duties_per_ra || secondary_ra.weekend_secondary_duties == weekend_duties_per_ra && weekend_duties_remainder >= weekend_duties) {
            ++secondary_ra.weekend_secondary_duties;
            break;
          }
        } else {
          if(secondary_ra.week_secondary_duties < week_duties_per_ra || secondary_ra.week_secondary_duties == week_duties_per_ra && week_duties_remainder >= week_duties) {
            ++secondary_ra.week_secondary_duties;
            break;
          }
        }
      }
    } while(true);

    Logger.log("Selected RA '" + secondary_ra.name + "' for secondary on " + date_iter);
    
    cal.createAllDayEvent(primary_ra.name + " / " + secondary_ra.name, date_iter);

    if(is_weekend(date_iter))
      --weekend_duties;
    else
      --week_duties;
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
