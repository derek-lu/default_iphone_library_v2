$(document).ready(function() {
	// Removes the 300ms delay for click events.
	FastClick.attach(document.body);
	
	// Specify an absolute path for development so a new IPA does not have to be created for each change.
	var path = "";//http://lighthouse.adobe.com/users/derek/default_iphone_library_v2/";
	
	var jsFiles = [path + "js/model/LibraryCollection.js?r=" + Math.random(),	// Collection which stores the folio data for the library.
				   path + "js/controls/ButtonSheet.js?r=" + Math.random(), 		//Slide up view that displays a selection of buttons.
				   path + "js/controls/FlipSwitch.js?r=" + Math.random(), 		//Horizontal switch that toggles between off and on.
				   path + "js/view/FolioItemView.js?r=" + Math.random(), 		//Item renderer used to display a folio.
				   path + "js/view/LoginForm.js?r=" + Math.random(), 			//Slide up view that displays the login form.
				   path + "js/view/AppView.js?r=" + Math.random(),		 		// The application file which handles the main view.
				   path + "js/Config.js?r=" + Math.random()]; 					// Config file that contains settings.
	
	var css = path + "styles.css?r=" + Math.random();
	
	var jsFilesLoaded = 0;
	var isOnline = false;
	
	function init() {
		if (typeof adobeDPS == "undefined") { // testing on the desktop.
			isOnline = true;
			loadAssets();
		} else {
			// Check to see if there is an internet connection.
			$.ajax({
				type: "HEAD",
				url: "http://stats.adobe.com/",
				success: function() {
					isOnline = true;
					loadAssets();
				},
				
				// Unable to connect.
				error: function() {
					loadAssets();
				}
			})
		}
	}
	
	function loadAssets() {
		// Load the stylesheet.
		var el = document.createElement("link");
		el.setAttribute("rel", "stylesheet");
		el.setAttribute("type", "text/css");
		el.setAttribute("href", css);
		document.getElementsByTagName("head")[0].appendChild(el);
		
		loadJavaScriptFile(0);
	}
	
	function loadJavaScriptFile(index) {
		var path = jsFiles[index];
		var script = document.getElementsByTagName("script")[0];
		var el = document.createElement("script");
		el.onload = javascriptLoadHandler; 
		el.src = path;
		script.parentNode.insertBefore(el, script);
	}
	
	function javascriptLoadHandler() {
		jsFilesLoaded += 1;
		if (jsFilesLoaded == jsFiles.length) {
			new ADOBE.AppView(typeof adobeDPS != "undefined", isOnline);
		} else {
			loadJavaScriptFile(jsFilesLoaded);
		}
	}

	// To test on the desktop remove the JavaScript include for AdobeLibraryAPI.js.
	if (typeof adobeDPS == "undefined") // Call init() immediately. This will be the case for dev on the desktop.
		init(); 
	else								// API is available so wait for adobeDPS.initializationComplete.
		adobeDPS.initializationComplete.addOnce(function(){ init() });
});