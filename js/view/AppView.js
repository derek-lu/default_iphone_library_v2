/**
 * The main application file.
 */
var ADOBE = ADOBE || {};

ADOBE.AppView = Backbone.View.extend({
	el: $("body"),
	
	libraryCollection: null,
	
	isOnline: false,
	
	folios: [],
	
	subscriptionLabels: [],
	
	subscriptions: [],
	
	LBL_SIGN_IN: "Sign In",
	LBL_SIGN_OUT: "Sign Out",
	
	numVisibleFoliosAtStartup: 6,
	
	folioItemViewArray: [],
	
	isShowSubscriptions: false,
	
	initialize: function(isAPIAvailable, isOnline) {
		// Set a flag for the API availability in the ADOBE namespace.
		ADOBE.isAPIAvailable = isAPIAvailable;
		
		this.isOnline = isOnline;
		
		$("body").append("<div class='header'><div id='title'><div id='spinner' class='spinner'></div>Updating Library...</div></div>");
		
		// Options for the indeterminate spinner.
		var opts = {
				  lines: 13, // The number of lines to draw
				  length: 3, // The length of each line
				  width: 2, // The line thickness
				  radius: 6, // The radius of the inner circle
				  corners: 0, // Corner roundness (0..1)
				  rotate: 0, // The rotation offset
				  direction: 1, // 1: clockwise, -1: counterclockwise
				  color: '#000000', // #rgb or #rrggbb
				  speed: 1, // Rounds per second
				  trail: 60, // Afterglow percentage
				  shadow: false, // Whether to render a shadow
				  hwaccel: false, // Whether to use hardware acceleration
				  className: 'spinner', // The CSS class to assign to the spinner
				  zIndex: 2e9, // The z-index (defaults to 2000000000)
				  top: -1, // Top position relative to parent in px
				  left: 22 // Left position relative to parent in px
				};
		var target = document.getElementById("spinner");
		this.spinner = new Spinner(opts).spin(target);

		if (isAPIAvailable) {
			var transaction = adobeDPS.libraryService.updateLibrary();
			transaction.completedSignal.addOnce(this.updateLibraryHandler, this);
		} else { // Testing on the desktop.

			var scope = this;
			setTimeout(function() {
				scope.updateLibraryHandler();
			}, 300);
		}
	},
	
	updateLibraryHandler: function() {
		var loginLbl;

		if (ADOBE.isAPIAvailable) {
			// Put the FolioStates in the ADOBE namespace for easier lookup later.
			ADOBE.FolioStates = adobeDPS.libraryService.folioStates;
			
			// Sort the folios descending.
			var list = adobeDPS.libraryService.folioMap.sort(function (a, b) {
				if (a.publicationDate < b.publicationDate)
					return 1;
				else if (a.publicationDate > b.publicationDate)
					return -1;
				else
					return 0;
			});

			// list is an associative array so put them in a regular array.
			for (var i in list) {
				if (this.isOnline) { // User is online so display all the folios.
					this.folios.push(list[i]);
				} else {			// User is offline so only display the installed folios.
					if (list[i].state == ADOBE.FolioStates.INSTALLED)
						this.folios.push(list[i]);
				}
			}

			var userOwnsLatestFolio = false;
			// If the latest folio is not purchasable then the user is entitled to it.
			// If true then do not display the subscription button.
			if (this.folios.length > 0) {
				var latestFolio = this.folios[0];
				userOwnsLatestFolio = latestFolio.state > ADOBE.FolioStates.PURCHASABLE;
			} else if (!this.isOnline) { // Folio list is empty and user is not online.
				$("body").html("<div class='offline'>Please connect to the internet to download issues.</div>");
				return;
			}
			
			if (!userOwnsLatestFolio) {
				// Loop through the subscriptions and populate the buttons.
				var availableSubscriptions = adobeDPS.receiptService.availableSubscriptions;
				for (var s in availableSubscriptions) {
					var availableSubscription = availableSubscriptions[s];
					if (availableSubscription.isActive()) { // Users owns a subscription so do not display the subscription menu option. 
						this.isShowSubscriptions = false;
						break;
					} else { // Create a string for the subscription buttons.
						this.subscriptionLabels.push(availableSubscription.duration + " subscription for " + availableSubscription.price);
						this.isShowSubscriptions = true;
					}
	
					this.subscriptions.push(availableSubscription);
				}
			}
			
			// Determine the login label for the drop down menu.
			loginLbl = adobeDPS.authenticationService.isUserAuthenticated ? this.LBL_SIGN_OUT : this.LBL_SIGN_IN;
		} else { // Placeholder values for testing on the desktop.
			this.subscriptionLabels = ["1 Year for $12.99", "1 Month for $1.99"];
			loginLbl = this.LBL_SIGN_IN;
		}
		
		var html  = "<div id='content-container'>";
			html +=     "<div id='content'>";
			html +=         "<div id='content-front'>"; // The container that displays the folios.
		    html +=             "<div class='header'>";
		    
		if (ADOBE.Config.IS_HEADER_TEXT)
		    html +=					"<div id='title'>Local</div>";
		else
			html +=					"<img id='title-image' src=''>";

		    html +=             	"<div id='settings-button'></div>";
		    html +=         	"</div>";
		    
			html +=             "<div id='folio-container'>";
		
		if (!ADOBE.isAPIAvailable || ADOBE.Config.IS_ENTITLEMENT_VIEWER)
			html +=             "<div id='banner'></div>";
		
			html +=					"<div id='row-loader'><div id='spinner' class='spinner'></div></div>";
			html +=				"</div>";
		    html +=         "</div>";
		    html +=         "<div id='content-back'>"; // The container that displays the settings.
		    html +=             "<div class='header'>";
		    html +=                 "<div id='title'>Settings</div>";
		    html +=                 "<div class='text-link' id='settings-done-button'>Done</div>";
		    html +=             "</div>";
			html +=             "<div id='settings'>";
			html +=                 "<div id='restore-all-purchases' class='settings-row text-link'>Restore Purchases</div>";
			
		// If API is not available then testing on the desktop so show the button, otherwise only if subscriptions are available.
		if (!ADOBE.isAPIAvailable || this.isShowSubscriptions)
			html +=             "<div id='subscribe' class='settings-row text-link'>Subscribe</div>";
			
		// If API is not available then testing on the desktop so show the button, otherwise only if this is an entitlement viewer.
		if (!ADOBE.isAPIAvailable || ADOBE.Config.IS_ENTITLEMENT_VIEWER)
			html +=             "<div id='print-subscriber' class='settings-row text-link'>" + loginLbl + "</div>";
			
		 // If testing on desktop then include the switch otherwise make sure it is supported.
		if (!ADOBE.isAPIAvailable || adobeDPS.settingsService.autoArchive.isSupported)
			html +=             "<div class='settings-row settings-row-auto-archive'>Auto Archive<div id='auto-archive' class='flip-switch'></div></div>";

			html +=             "</div>";
			html +=         "</div>";
			html +=     "</div>";
			html += "</div>";
		
		// Uncomment the textarea below to enable debug output via debug().
		//html += "<textarea class='debug'></textarea>";
		window.debug = function(value) {
			$(".debug").val($(".debug").val() + ($(".debug").val() == "" ? "" : "\n") + value);
		}
		
		this.spinner.stop();

		$("body").html(html);

		// Options for the indeterminate spinner.
		var opts = {
				  lines: 13, // The number of lines to draw
				  length: 3, // The length of each line
				  width: 2, // The line thickness
				  radius: 6, // The radius of the inner circle
				  corners: 0, // Corner roundness (0..1)
				  rotate: 0, // The rotation offset
				  direction: 1, // 1: clockwise, -1: counterclockwise
				  color: '#000000', // #rgb or #rrggbb
				  speed: 1, // Rounds per second
				  trail: 60, // Afterglow percentage
				  shadow: false, // Whether to render a shadow
				  hwaccel: false, // Whether to use hardware acceleration
				  className: 'spinner', // The CSS class to assign to the spinner
				  zIndex: 2e9, // The z-index (defaults to 2000000000)
				  top: 14, // Top position relative to parent in px
				  left: 148 // Left position relative to parent in px
				};

		var target = document.getElementById("spinner");
		this.spinner = new Spinner(opts).spin(target);

		$("#settings .flip-switch").flipSwitch({state: !ADOBE.isAPIAvailable || adobeDPS.settingsService.autoArchive.isEnabled ? "on" : "off"});
		
		// Make sure the last child in the settings isn't an hr. This will occur if auto-archive is not supported.
		if ($("#settings").find(">:last-child").prop("tagName") == "HR")
			$("#settings").find(">:last-child").remove();
		
		var scope = this;
		
		// User clicked the gear icon so show the settings view.
		$("#settings-button").on("click", function() {
			$("#content-front").css("z-index", 1);
			$("#content-container #content").css("-webkit-transform",  "rotateY(180deg)");
		});
		
		// Go back to the default view.
		$("#content-back #settings-done-button").on("click", function() {
			$("#content-front").css("z-index", 0);
			$("#content-container #content").css("-webkit-transform",  "rotateY(0deg)");
		});
		
		// Handler for "restore purchases" from settings screen.
		$("#restore-all-purchases").on("click", function() {
			$("body").buttonSheet({title: "Do you want to restore your previous purchases?", buttons: ["Yes"]}).one("change", function(e, buttonIndex) {
				if (buttonIndex == 0) {
					var transaction = adobeDPS.receiptService.restorePurchases();
					
					$("#content-back .header #title").hide();
					$("<div id='spinner-title'><div id='spinner2' class='spinner'></div>Restoring Purchases...</div>").appendTo("#content-back .header");
					
					// Options for the indeterminate spinner.
					var opts = {
							  lines: 13, // The number of lines to draw
							  length: 3, // The length of each line
							  width: 2, // The line thickness
							  radius: 6, // The radius of the inner circle
							  corners: 0, // Corner roundness (0..1)
							  rotate: 0, // The rotation offset
							  direction: 1, // 1: clockwise, -1: counterclockwise
							  color: '#000000', // #rgb or #rrggbb
							  speed: 1, // Rounds per second
							  trail: 60, // Afterglow percentage
							  shadow: false, // Whether to render a shadow
							  hwaccel: false, // Whether to use hardware acceleration
							  className: 'spinner', // The CSS class to assign to the spinner
							  zIndex: 2e9, // The z-index (defaults to 2000000000)
							  top: 0, // Top position relative to parent in px
							  left: 40 // Left position relative to parent in px
							};
					var target = document.getElementById("spinner2");
					var spinner = new Spinner(opts).spin(target);
					
					transaction.completedSignal.addOnce(function() {
						$("#content-back .header #title").show();
						spinner.stop();
						$("#spinner-title").remove();
					}, this);
					
				}
			});
		});
		
		// Handler for subscribe from settings screen.
		$("#subscribe").on("click", function() {
			scope.displaySubscribeButtonSheet();
		});
		
		$("body").on("subscribeButtonClicked", function() { scope.displaySubscribeButtonSheet() });
		
		// Handler for "print subscriber login" from settings screen.
		$("#print-subscriber").on("click", function() { scope.printSubscriber_clickHandler() });
		
		// Handler for "auto archive" from the settings screen.
		$("body").on("change", "#auto-archive", function(e, isOn) {
			adobeDPS.settingsService.autoArchive.toggle(isOn);
		});
		
		$("#folio-container").height(window.innerHeight - $("#folio-container").position().top); 
		$("#content-back").height(window.innerHeight);
		
		// On a device this is called when the page stops scrolling rather than during the scroll.
		$("#folio-container").on("scroll", function(e){
			scope.addRow(e);
		});
		
		if (ADOBE.Config.IS_ENTITLEMENT_VIEWER) {
			$("#banner").on("click", function() {
				adobeDPS.dialogService.open(ADOBE.Config.BANNER_TARGET_URL);
			});
		}
		
		if (ADOBE.isAPIAvailable) {
			// The collection creates a clone of the folio objects so addFolios() passes a reference to the object.
			// Since the folios are not on a server we don't need to load anything so pass the folios to the constructor.
			this.libraryCollection = new ADOBE.LibraryCollection(this.folios);
			
			// Add the folios which are currently available. On the first launch this
			// does not guarentee that all folios are immediately available. The callback
			// below for folioMap.addedSignal will handle folios which are added after
			// startup. Added does not mean, pushed from folio producer, rather they
			// are folios that the viewer becomes aware of after startup.
			this.addFolios();
			
			// Add a listener for when new folios are added.
			adobeDPS.libraryService.folioMap.addedSignal.add(function(folios) {
				debug("ADD FOLIO")
				for (var i = 0; i < folios.length; i++) {
					scope.addFolio(folios[i]);
				}
			}, this);
		} else {
			_.bindAll(this, "addFolios");
			this.libraryCollection = new ADOBE.LibraryCollection();
			this.libraryCollection.url = ADOBE.Config.FULFILLMENT_URL;
			this.libraryCollection.on("all", this.addFolios);
			this.libraryCollection.fetch({dataType: "xml"});
		}
	},
	
	addFolios: function() {
		var len = this.libraryCollection.length;
		for (var i = 0; i < len; i++) {
			// When using the DPS api this is a clone of the original folio.
			var folio = this.libraryCollection.at(i);
			
			// Testing on the desktop so set create the path to the image.
			if (!ADOBE.isAPIAvailable)
				folio.attributes.libraryPreviewUrl +=  "/portrait";
		}
		
		var $folioContainer = $("#folio-container");
		var numFolios = Math.min(this.numVisibleFoliosAtStartup, this.libraryCollection.length);
		for (var i = 0; i < numFolios; i++) {
			var view = new ADOBE.FolioItemView({model: this.libraryCollection.at(i)});
			view.render().$el.insertBefore("#row-loader");
			this.folioItemViewArray.push(view);
		}
		
		if (this.isShowSubscriptions)
			this.folioItemViewArray[0].showSubscribeButton(true);
		
		if (this.libraryCollection.length == this.folioItemViewArray.length) {
			this.spinner.stop();
			$("#row-loader").css("display",  "none");
		}
	},
	
	addRow: function() {
		if ($("#folio-container").scrollTop() + $("#folio-container").innerHeight() + 20 >= $("#folio-container")[0].scrollHeight) {
			var numFoliosToAdd = 2;
			
			var startIndex = this.folioItemViewArray.length;
			var endIndex = Math.min(startIndex + numFoliosToAdd, this.libraryCollection.length); // Calculate the end index.
			if (endIndex > this.folioItemViewArray.length) { // this.folioItemViewArray.length is the number of visible items. 
				for (var i = startIndex; i < endIndex; i++) {
					var view = new ADOBE.FolioItemView({model: this.libraryCollection.at(i)});
					view.render().$el.insertBefore("#row-loader");
					this.folioItemViewArray.push(view);
				}
			}
			
			if (this.libraryCollection.length == this.folioItemViewArray.length) {
				this.spinner.stop();
				$("#row-loader").css("display",  "none");
			}
		}
	},
	
	// This will be triggered when folios are added through the API.
	addFolio: function(folio) {
		var len = this.folios.length;
		// Find the insert index. Folios are sorted by publicationDate with the most recent first.
		for (var i = 0; i < len; i++) {
			if (folio.publicationDate >= this.folios[i].publicationDate)
				break;
		}

		// Add the folio to the collection.
		this.libraryCollection.add(folio, {at: i});
		
		// Add the folio to the folios.
		this.folios.splice(i, 0, folio);
		
		// Figure out if the user has or is entitled to the latest folio or has a subscription covering today's date.
		// If the latest folio is not purchasable then the user is entitled to it.
		// If true then do not display the subscription button or tile.
		var userOwnsLatestFolio = false;
		if (this.folios.length > 0) {
			var latestFolio = this.folios[0];
			userOwnsLatestFolio = latestFolio.state > ADOBE.FolioStates.PURCHASABLE;
		}

		if (!userOwnsLatestFolio) {
			var availableSubscriptions = adobeDPS.receiptService.availableSubscriptions;
			for (var s in availableSubscriptions) {
				var availableSubscription = availableSubscriptions[s];
				if (availableSubscription.isActive()) { // Users owns a subscription so do not display the subscription menu option. 
					userOwnsLatestFolio = true;
					break;
				}
			}
		}
		
		// Figure out if this folio should be displayed.
		// Folios can be added in any order so see if this folio is within the range of publication
		// dates of the folios that are currently displayed.
		var numFoliosDisplayed = this.folioItemViewArray.length;
		if (i <= numFoliosDisplayed) {
			var view;
			if (this.folioItemViewArray.length >= this.numVisibleFoliosAtStartup) {
				// Remove the last folio view before inserting a new one
				$("#folio-container div.folio-item-view:last").remove();
				view = this.folioItemViewArray.pop();
				view.clear();
			}
				
			view = new ADOBE.FolioItemView({model: this.libraryCollection.at(i)});
			
			if (numFoliosDisplayed == 0)
				view.render().$el.insertBefore("#row-loader");
			else
				$("#folio-container div.folio-item-view").eq(i).before(view.render().$el);
				
			this.folioItemViewArray.splice(i, 0, view);
		}
		
		// Hide the subscribe button and tile.
		if (userOwnsLatestFolio) {
			// Hide the subscribe button from the first folio.
			if (this.folioItemViewArray.length > 0)
				this.folioItemViewArray[0].showSubscribeButton(false);

			$("#subscribe").css("display", "none");
			$("#subscribe-hr").css("display", "none");
		} else {
			// Only the first folio should display the subscribe button.
			if (this.folioItemViewArray.length > 0)
				this.folioItemViewArray[0].showSubscribeButton(true);
				
			$("#subscribe").css("display", "block");
			$("#subscribe-hr").css("display", "block");
		}
		
		// In case a folio was added at the zero index then hide
		// the subscribe button of the previous visible subscribe button.
		this.folioItemViewArray[1].showSubscribeButton(false);
		
		if (this.libraryCollection.length == this.folioItemViewArray.length) {
			this.spinner.stop();
			$("#row-loader").css("display",  "none");
		}
	},
	
	printSubscriber_clickHandler: function() {
		if (ADOBE.isAPIAvailable && adobeDPS.authenticationService.isUserAuthenticated) {
			var transaction = adobeDPS.authenticationService.logout();
			transaction.completedSignal.addOnce(function(transaction) {
				// Update the button label
				if (transaction.state == adobeDPS.transactionManager.transactionStates.FINISHED)
					$("#print-subscriber").html(this.LBL_SIGN_IN);
			}, this);
		} else {
			this.displayLogin();
		}
	},
	
	displayLogin: function() {
		var loginForm = new ADOBE.LoginForm();
		$("body").append(loginForm.render().el);
		var scope = this;
		// Update the label of the item in the drop down menu when a user successfully logs in.
		loginForm.$el.on("loginSuccess", function(){
			$("#print-subscriber").html(scope.LBL_SIGN_OUT);
			loginForm.$el.off("loginSuccess");
		});
	},
	
	displaySubscribeButtonSheet: function() {
		// The text that is displayed at the top of the button sheet.
		var title = "Select a digital subscription option below. Your digital subscription will start immediately from the latest issue after you complete the purchase process.";
		var scope = this;
		$("body").buttonSheet({title: title, buttons: this.subscriptionLabels}).one("change", function(e, buttonIndex) {
			scope.subscribeButtonSheet_changeHandler(buttonIndex);
		});
	},
	
	subscribeButtonSheet_changeHandler: function(buttonIndex) {
		if (buttonIndex < this.subscriptions.length) { // disregard the last button since it is the cancel button.
			var transaction = this.subscriptions[buttonIndex].purchase();
			transaction.completedSignal.addOnce(function(transaction) {
				if (transaction.state == adobeDPS.transactionManager.transactionStates.FINISHED) {
					// Remove the subscribe button if a subscription was purchased successfully.
					$("#subscribe").remove();
					$("#subscribe-hr").remove();
				} else if (transaction.state == adobeDPS.transactionManager.transactionStates.FAILED) {
					alert("Unable to purchase subscription.");
				}
			});
		}
	}
});
