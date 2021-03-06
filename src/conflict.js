var selectedSchedule = [];
var finals = [];
var ratings = null;

const RED = "rgb(255, 220, 220)";
const YELLOW = "rgb(255, 244, 112)";
const GREEN = "rgb(206, 255, 206)";
const BLUE = "rgb(207, 228, 255)";

function Course(name, start, end, days){
	this.name = name;
	this.days = days.replace(/,/g, '');
	this.start = start;
	this.end = end;
}

Course.prototype.conflicts = function(class2){ //Check if two classes conflict
	for(var day = 0; day < this.days.length; day++){ //Check the days
		var sameDay = class2.days.includes(this.days.charAt(day));
		var sameTime = this.start <= class2.end && this.end >= class2.start;
		if(sameDay && sameTime){
			return class2.name;
		}
	}
	return false;
}

function Final(date, time){
	this.name;
	this.date = date;
	this.startTime = convertTime(time);
	this.endTime = this.startTime + 200;
}

Final.prototype.conflicts = function(final2){
	return this.date == final2.date &&
	this.startTime <= final2.endTime && this.endTime >= final2.startTime;
}

//Converts to 24hr time
function convertTime(time12h) {
	time12h = time12h.trim();
	const [time, modifier] = time12h.split(' ');
  	let [hours, minutes] = time.split(':');
  	if (modifier === 'PM' && hours != "12") {
    	hours = parseInt(hours, 10) + 12;
  	}
 	return Number(hours + minutes);
}

$(document).ready(function(){
	//Preload your schedule into an array
	loadSchedule();

	//Overwrite the main functions in Schedule Builder API to mark conflicts
	var oldDrop = getDropCourseConfirmation;
	getDropCourseConfirmation = function(courseID,ThisButton,ThisFunction,source){
		oldDrop(courseID,ThisButton,ThisFunction,source);
		setTimeout(function(){
			updateConflicts("#courseResultsDiv");
			updateConflicts("#inlineCourseResultsDiv");
		}, 1000);
	}

	var oldRemove = updateCourseSelections;
	updateCourseSelections = function(generalCourseID,specificCourseID,ThisElement,specifiedAction,spinnerColor){
		oldRemove(generalCourseID,specificCourseID,ThisElement,specifiedAction,spinnerColor);
		setTimeout(function(){
			updateConflicts("#courseResultsDiv");
			updateConflicts("#inlineCourseResultsDiv");
		}, 1000);
	}

	var oldAdd = UCD.SAOT.COURSES_SEARCH.addCourse;
	UCD.SAOT.COURSES_SEARCH.addCourse = function(resultsRow,ThisButton){
		oldAdd(resultsRow, ThisButton);
		setTimeout(function(){
			updateConflicts("#courseResultsDiv");
			updateConflicts("#inlineCourseResultsDiv")
		}, 1000);
	}


	var oldInlineAdd = UCD.SAOT.COURSES_SEARCH_INLINE.addCourse;
	UCD.SAOT.COURSES_SEARCH_INLINE.addCourse = function(resultsRow,ThisButton){
		oldInlineAdd(resultsRow, ThisButton);
		setTimeout(function(){
			updateConflicts("#inlineCourseResultsDiv");
		}, 1000);
	}

	//These functions are overridden to append the Ratings label to the header. The rest is handled internally in the two textSearch files
	var oldSearch = UCD.SAOT.COURSES_SEARCH.textSearch;
	UCD.SAOT.COURSES_SEARCH.textSearch = function(){
		oldSearch();
		var header = document.getElementsByClassName('data-header-long data-row clearfix')[2].childNodes[1].childNodes;
		if (header[11].style.width != "10%") { // Add the ratings label
			header[11].style.width = "10%";
			header[11].parentNode.innerHTML += '<div class="data-column column-header align-left" style="width:8%;">Ratings:</div>';
		}
	}


	var oldInline = UCD.SAOT.COURSES_SEARCH_INLINE.textSearch;
	UCD.SAOT.COURSES_SEARCH_INLINE.textSearch = function(){
		oldInline();
		var header = document.getElementsByClassName('data-column column-header align-left');
		if (header[5].style.width != "10%") { // Add the ratings label
			header[5].style.width = "10%";
			header[5].parentNode.innerHTML += '<div class="data-column column-header align-left" style="width:8%;">Ratings:</div>';
		}
	}

	//Load in the rate my professor ratings from the server
    $.ajax({
    			'async': true,
    			'global': false,
    			'url': "https://schedulehelper.info/api/rateapi/api.php",
    			'dataType': "json",
    			'success': function (data) {
    					ratings = data;
    			},
    			error: function(request,status,errorThrown) {
    					ratings = classData;
    			}

    	});
});

//Loop through and update the conflicts if user adds/removes any classes
function updateConflicts(divName){
	loadSchedule();
	var searchResults = $(divName).children();
	if(searchResults.length){
		searchResults.each(function(){ //For every class in search results
			var meetings = $(this).find(".meetings").children();
			//Check if its in your schedule
			if(inSchedule(this)){
				$(this).css({"background-color":BLUE}); //Change to blue
				return; //Continue
			}
			var conflicts = false;
			for(var i = 0; ($(meetings[i]).children()[1]) && !conflicts; i++){ //Check every meeting (lecture, discussion, lab)
				var times = $(meetings[i]).children()[1].innerHTML;
				var days = $(meetings[i]).children()[2].innerHTML;
				var potential = new Course("", convertTime(times.slice(0,8)),convertTime(times.slice(10)), days);
				//Loop through current schedule to check for conficts
				for(var curr = 0; curr < selectedSchedule.length; curr++){
					conflicts = potential.conflicts(selectedSchedule[curr]);
					if(conflicts){break;}
				}
			}
			if(!conflicts){ //Check finals
				conflicts = finalsConflict(this);
			}
			if(conflicts){
				$(this).css({"background-color": RED}); //Change to red
				addTooltip(this, conflicts);
			} else if (isFull(this)){
				$(this).css({"background-color": YELLOW}); //Change to yellow
				removeTooltip(this);
			} else {
				$(this).css({"background-color": GREEN}); //Change to green
				removeTooltip(this);
			}
		});
	}
}

//Adds a tooltip to display which class conflicts
function addTooltip(element, conflictName){
	var title = $(element).find(".data-column.title")[1];
	$(title).attr("data-balloon", "Conflicts with: " + conflictName);
	$(title).attr("data-balloon-pos", "up");
}

//Removes tooltips for when user removes classes and conflicts change
function removeTooltip(element){
	var title = $(element).find(".data-column.title")[1];
	$(title).removeAttr("data-balloon");
	$(title).removeAttr("data-balloon-pos");
}

//Checks if a class is already in your schedule
function inSchedule(listing){
	var savedBtn = $(listing).find(".btn-success");
	if(!savedBtn.length){return false;}
	//This check is added because saved button stays there after you remove a class
	var title = $(listing).find(".data-column.title")[1].innerHTML;
	for(var i = 0; i < selectedSchedule.length; i++){
		if(selectedSchedule[i].name.includes(title)){
			return true;
		}
	}
	return false;
}

//Checks if a final conflicts with current finals
function finalsConflict(element){
	var final = getFinal(element, ".details", ".title");
	if(final){
		for(var i = 0; i < finals.length; i++){
			if(final.conflicts(finals[i])){return finals[i].name;}
		}
	}
	return false;
}

//Returns if a class is full or not
function isFull(element){
	var description = $(element).find(".data-column.title")[1].parentNode;
	var seats = description.childNodes[3].innerHTML;
	return seats.charAt(0) == "0";
}

//Preloads the currently selected schedule into two arrays: one for classes and one for finals
function loadSchedule(){
	//Reset arrays
	selectedSchedule = [];
	finals = [];
	var schedule = $('.CourseItem.gray-shadow-border.clearfix');
	schedule.each(function(index, element){ //For every class in your schedule
		var name = $(".classTitle.height-justified");
		var classTitle = name[index].innerHTML;
		var sections = $(this).find(".meeting.clearfix");
		//Get the final if it has one
		var final = getFinal(this, ".classDescription", ".boldTitle");
		if(final){
			final.name = classTitle + " Final";
			finals.push(final);
		}
		sections.each(function(){ //For every meeting (lecture, discussion, lab)
			var sectionInfo = $(this).children();
			var times = sectionInfo[1].innerHTML;
			var days = sectionInfo[2].innerHTML;
			if(days){ //Not an empty string, so add to schedule
				var newClass = new Course(classTitle, convertTime(times.slice(0,8)), convertTime(times.slice(10)), days);
				selectedSchedule.push(newClass);
			}
		});
	});
}

//Gets the time and date of a final and return it as an object
function getFinal(element, div, title){
	var data = $(element).find(div);
	var finalText = $(data[0]).find(title + ":contains('Final')").parent();
	if(finalText.length){
		var string = finalText[0].innerHTML;
		var firstDigit = string.search(/\d/);
		string = string.substr(firstDigit);
		var space = string.search(" ");
		var date = string.substr(0, space);
		var time = string.substr(space + 1);
		return new Final(date, time);
	}
}
