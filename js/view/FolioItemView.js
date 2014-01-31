/**
 * Displays a folio in the grid.
 */
var ADOBE = ADOBE || {};

ADOBE.FolioItemView = Backbone.View.extend({
	tagName:  "div",
	
	className: "folio-item-view",
	
	initialize: function() {
		var html  = "<img class='folio-thumb' width='56' height='81'/>";
		    html += "<div class='text'>";
		    html +=     "<div class='magazine-title'><%= title %></div>";
			html +=		"<div class='folio-number'><%= folioNumber %></div>";
		    html +=     "<div class='state'></div>";
		    html += "</div>";
		    html += "<div class='button-container'>";
		    html +=     "<div class='button blue-button' id='buy-button'></div>";
		    html += "</div>";
			
		this.template = _.template(html);
	},
	
	// The dialog asking whether or not to update the folio if an update is available.
	updateDialog: null,
	
	isTrackingTransaction: false,
	
	// A reference to the current downloadTransaction. Used to pause and resume a download.
	currentDownloadTransaction: null,
	
	// A reference to the original folio since the collection uses a cloned copy.
	folio: null,
	
	isBuyButtonEnabled: true,
	
	months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
	
	// Flag to track whether or not the download button initiated a download.
	// If it was clicked and the folio is viewable && Config.IS_AUTO_OPEN_DOWNLOADED_FOLIO then automatically open the folio.
	// This will not be the case if a user toggled views and a download is resumed.
	downloadButtonWasClicked: false,
	
	$archiveButton: null,
	
	render: function() {
		var json = this.model.toJSON();
		
		this.$el.html(this.template(json));

		this.$stateLabel = this.$el.find(".state");

		if (ADOBE.isAPIAvailable) {
			//Get a reference to the original folio object.
			this.folio = adobeDPS.libraryService.folioMap.internal[this.model.attributes.id];
			
			var scope = this;
			
			// Set a delay to load the preview image in case this renderer has
			// already been removed from the DOM. This will be the case when
			// multiple folios are added within the same frame from the API causing
			// some folios to be added and then removed immediately.
			// Hide the img before it loads otherwise a grey border is visible.
			this.$el.find(".folio-thumb").css("visibility", "hidden");
			setTimeout(function(){ scope.loadPreviewImage() }, 100);
			
			this.updateView();

			// Add the handlers for the buttons.
			this.$el.find("#buy-button").on("click", function() { scope.buyButton_clickHandler() });
			
			// Add a handler to listen for updates.
			this.folio.updatedSignal.add(this.updatedSignalHandler, this);

			// Determine if the folio was in the middle of downloading.
			// If the folio is downloading then find the paused transaction and resume.
			if (this.folio.state == ADOBE.FolioStates.DOWNLOADING) {
				var transactions = this.folio.currentTransactions;
				var len = transactions.length;
				for (var i = 0; i < len; i++) {
					var transaction = transactions[i];
					if (transaction.state == adobeDPS.transactionManager.transactionStates.PAUSED) {
						transaction.resume();
						break;
					}
				}
			}
		} else { // Testing on the desktop.
			this.$el.find(".folio-thumb").attr("src", json.libraryPreviewUrl);
			this.$el.find(".state").html("$.98");
			this.$el.find("#buy-button").html("Buy");
		}

		return this;
	},
	
	clear: function() {
		this.$el.off();
		this.$el.find("#buy-button").off();
		this.$el.find("#archive-button").off();
		this.folio.updatedSignal.remove(this.updatedSignalHandler, this);
	},
	
	loadPreviewImage: function() {
		if (this.el.parentElement) {
			var transaction = this.folio.getPreviewImage(135, 180, true);
			transaction.completedSignal.addOnce(this.getPreviewImageHandler, this);
		}
	},
	
	getPreviewImageHandler: function(transaction) {
		if (transaction.state == adobeDPS.transactionManager.transactionStates.FINISHED && transaction.previewImageURL != null) {
			this.$el.find(".folio-thumb").attr("src", transaction.previewImageURL);
			this.$el.find(".folio-thumb").css("visibility", "visible");
		} else if (transaction.previewImageURL == null) { // Sometimes previewImageURL is null so attempt another reload.
			var scope = this;
			setTimeout(function() {
				var transaction = scope.folio.getPreviewImage(135, 180, true);
				transaction.completedSignal.addOnce(scope.getPreviewImageHandler, scope);
			}, 200);
		}
	},
	
	updatedSignalHandler: function(properties) {
		this.updateView();
		
		// The buy button is disabled before downloading so if it is made viewable
		// during the download then enable it again. 
		if (properties.indexOf("isViewable") > -1 && this.folio.isViewable) {
			this.enableBuyButton(true);
			if (this.downloadButtonWasClicked && ADOBE.Config.IS_AUTO_OPEN_DOWNLOADED_FOLIO)
				this.folio.view();
		}

		if ((properties.indexOf("state") > -1 || properties.indexOf("currentTransactions") > -1) && this.folio.currentTransactions.length > 0)
			this.trackTransaction();
	},
	
	// Updates the view with the proper labels, buttons and download status.
	updateView: function() {
		var state = "";
		var label = "";
		switch (this.folio.state) {
			case ADOBE.FolioStates.INVALID:
				state = "Invalid";
				label = "Error";
				break;
			case ADOBE.FolioStates.UNAVAILABLE:
				state = "Unavailable";
				label = "Error";
				break;
			case ADOBE.FolioStates.PURCHASABLE:
				state = this.folio.price;
				label = "Buy";
				break;
			case ADOBE.FolioStates.ENTITLED:
				this.showArchiveButton(false);
				this.showDownloadStatus(false);
				this.enableBuyButton(true);
				
				state = this.folio.isFree() ? "FREE" : "Purchased";
				label = "Download";
				break;
			case ADOBE.FolioStates.DOWNLOADING:
				if (!this.folio.isViewable)
					this.enableBuyButton(false);
				
				this.showDownloadStatus(true);
				this.showArchiveButton(true);
				
				this.$el.find("#archive-button").html("Cancel");
				
				if (!this.currentDownloadTransaction || (this.currentDownloadTransaction && this.currentDownloadTransaction.progress == 0)) {
					this.setDownloadPercent(0);
					state = "Waiting";
				}

				label = "View";
				break;
			case ADOBE.FolioStates.INSTALLED:
				this.showDownloadStatus(false);
				this.showArchiveButton(true);
				this.$el.find("#archive-button").html("Archive");
				label = "View";
				break;
			case ADOBE.FolioStates.PURCHASING:
				label = "View";
				state = "Purchasing";
				break;
			case ADOBE.FolioStates.EXTRACTING:
			case ADOBE.FolioStates.EXTRACTABLE:
				state = "Extracting";
				label = "View";
				break;
		}
		
		this.$el.css("display", this.folio.state == ADOBE.FolioStates.INVALID || this.folio.state == ADOBE.FolioStates.UNAVAILABLE ? "none" : "block");
		this.$stateLabel.html(state);
		this.$el.find("#buy-button").html(label);
	},

	trackTransaction: function() {
		if (this.isTrackingTransaction)
			return;
			
		var transaction;
		for (var i = 0; i < this.folio.currentTransactions.length; i++) {
	        transaction = this.folio.currentTransactions[i];
	        if (transaction.isFolioStateChangingTransaction()) {
	            // found one, so break and attach to this one
	            break;
	        } else {
	            // null out transaction since we didn't find a traceable one
	            transaction = null;
	        }
	    }
	
		if (!transaction)
			return;

		var transactionType = transaction.jsonClassName;
		if (transactionType != "DownloadTransaction" &&
			transactionType != "UpdateTransaction" &&
			transactionType != "PurchaseTransaction" &&
			transactionType != "ArchiveTransaction" &&
			transactionType != "ViewTransaction") {
				return;
		}

		// Check if the transaction is active yet
		if (transaction.state == adobeDPS.transactionManager.transactionStates.INITALIZED) {
			// This transaction is not yet started, but most likely soon will
			// so setup a callback for when the transaction starts
			transaction.stateChangedSignal.addOnce(this.trackTransaction, this);
			return;
		}
		
		this.isTrackingTransaction = true;
		
		this.currentDownloadTransaction = null;
		if (transactionType == "DownloadTransaction" || transactionType == "UpdateTransaction") {
			transaction.stateChangedSignal.add(this.download_stateChangedSignalHandler, this);
			transaction.progressSignal.add(this.download_progressSignalHandler, this);
			transaction.completedSignal.add(this.download_completedSignalHandler, this);
			this.currentDownloadTransaction = transaction;
		} else {
			var state = "";
			if (transactionType == "PurchaseTransaction")
				state = "Purchasing...";
			else if (transactionType == "ArchiveTransaction")
				state = "Archiving...";
			else if (transactionType == "ViewTransaction")
				state = "Loading...";
			
			this.$stateLabel.html(state);
			
			// Add a callback for the transaction.
			transaction.completedSignal.addOnce(function() {
				this.$stateLabel.html("");
				this.isTrackingTransaction = false;
				
				// If this was an archive transaction then hide the button.
				if (transactionType == "ArchiveTransaction")
					this.showArchiveButton(false);
			}, this)
		}
	},
	
	// Handler for when a user clicks the buy button.
	buyButton_clickHandler: function() {
		var state = this.folio.state;
		
		if (state == ADOBE.FolioStates.PURCHASABLE) {
			this.purchase();
		} else if (state == ADOBE.FolioStates.INSTALLED || this.folio.isViewable) {
			if (this.folio.isUpdatable)
				this.displayUpdateDialog();
			else
				this.folio.view();
		} else if (state == ADOBE.FolioStates.ENTITLED) {
			if (this.isBuyButtonEnabled)
				this.folio.download();
		}
		
		this.downloadButtonWasClicked = true;
	},
	
	// Changes the opacity of the buyButton to give an enabled or disabled state.
	enableBuyButton: function(value) {
		this.$el.find("#buy-button").css("opacity", value ? 1 : .6);
		
		this.isBuyButtonEnabled = value;
	},
	
	// Purchases the folio.
	purchase: function() {
		var transaction = this.folio.purchase();
		transaction.completedSignal.addOnce(function(transaction) {
			if (transaction.state == adobeDPS.transactionManager.transactionStates.FINISHED) {
				this.isTrackingTransaction = false;
			} else if (transaction.state == adobeDPS.transactionManager.transactionStates.FAILED) {
				alert("Sorry, unable to purchase");
			}
			
			this.updateView();
		}, this);
	},
	
	// Displays the dialog for confirmation of whether or not to update the folio.
	displayUpdateDialog: function() {
		var title = "An updated version of " + this.folio.title + " is available. Do you want to download this update now?";
		var scope = this;
		$("body").buttonSheet({title: title, buttons: ["Yes", "No"]}).one("change", function(e, buttonIndex) {
			if (buttonIndex == 0) {
				scope.folio.update();
			} else if (buttonIndex == 1) {
				scope.folio.view();
			}
		});
	},
	
	// Downloads are automatically paused if another one is initiated so watch for changes with this callback.
	download_stateChangedSignalHandler: function(transaction) {
		if (transaction.state == adobeDPS.transactionManager.transactionStates.FAILED) {
			//alert("Unable to download folio.");
			this.download_completedSignalHandler(transaction);
			this.updateView();
			this.enableBuyButton(true);
		} else if (this.currentDownloadTransaction.state == adobeDPS.transactionManager.transactionStates.PAUSED) {
			this.$stateLabel.html("Download Paused");
			this.$el.find("#archive-button").html("Resume");
		} else {
			this.$el.find("#archive-button").html("Cancel");
		}
	},
	
	// Updates the progress bar for downloads and updates.
	download_progressSignalHandler: function(transaction) {
		if (transaction.progress > 0)
			this.$stateLabel.html("");

		this.setDownloadPercent(transaction.progress);
	},
	
	// Handler for when a download or update completes.
	download_completedSignalHandler: function(transaction) {
		transaction.stateChangedSignal.remove(this.download_stateChangedSignalHandler, this);
		transaction.progressSignal.remove(this.download_progressSignalHandler, this);
		transaction.completedSignal.remove(this.download_completedSignalHandler, this);
			
		this.isTrackingTransaction = false;
	},
	
	// Handler for when a user clicks the archive/cancel button.
	archiveButton_clickHandler: function() {
		var $archiveButton = this.$el.find("#archive-button");
		if (this.folio.state == ADOBE.FolioStates.DOWNLOADING) {
			if (!this.currentDownloadTransaction)
				return;

			if ($archiveButton.html() == "Resume") {
				this.$stateLabel.html("Waiting");
				this.currentDownloadTransaction.resume();
			} else {
				this.currentDownloadTransaction.cancel();
			}
		} else {
			try {
				if (this.folio.isArchivable) {
					$archiveButton.css("opacity", .7);

					if (this.folio.currentStateChangingTransaction() && this.folio.currentStateChangingTransaction().isCancelable) {
						var transaction = folio.currentStateChangingTransaction().cancel();
						transaction.completedSignal.addOnce(function() {
							var archiveTransaction = this.folio.archive();
							archiveTransaction.completedSignal.addOnce(function(transaction) {
								if (transaction.state == adobeDPS.transactionManager.transactionStates.FINISHED) {
									$archiveButton.css("opacity", 1);							
									this.showArchiveButton(false);
								}
							}, this);
						}, this)
					} else if (this.folio.isArchivable) {
						this.folio.archive();
					}
				}
			} catch (e) {
				alert("Unable to archive: " + e);
			}
		}
	},
	
	// Displays/Hides the download/update progress bar.
	showDownloadStatus: function(value) {
		if (value) {
			if (!this.$downloadStatus) {
				var html  = "<div class='progress-track'><div class='progress-bar' /></div>";
				
				this.$downloadStatus = $(html);
				this.$downloadStatus.insertAfter(this.$stateLabel);
			}
		} else {
			if (this.$downloadStatus) {
				this.$downloadStatus.remove();
				this.$downloadStatus = null;
			}
		}
	},
	
	// Sets the download progress bar.
	setDownloadPercent: function(value) {
		value *= .01;
		
		var maxWidth = 320; // Max width of track.
		this.$el.find(".progress-bar").css("width", Math.min(maxWidth * value, maxWidth));
	},
	
	showArchiveButton: function(value) {
		if (value) {
			if (!this.$archiveButton) {
				this.$archiveButton = $("<div class='button blue-button' id='archive-button'>Archive</div>");
				this.$archiveButton.insertBefore(this.$el.find("#buy-button"));
				var scope = this;
				this.$archiveButton.on("click", function() { scope.archiveButton_clickHandler() });
			}
			
			this.$archiveButton.css("display", "block");
			
			// If the archive button is visible then the subscribe button will never be visible.
			this.showSubscribeButton(false);
		} else {
			if (this.$archiveButton)
				this.$archiveButton.css("display", "none");
		}
	},
	
	showSubscribeButton: function(value) {
		if (value) {
			if (this.$el.find("#subscribe-button").length == 0) {
				var html = "<div class='blue-button button' id='subscribe-button'>Subscribe</div>";
				this.$el.find(".button-container").append(html);
				
				var scope = this;
				this.$el.find("#subscribe-button").on("click", function(){ scope.$el.trigger("subscribeButtonClicked") });
			}
		} else {
			this.$el.find("#subscribe-button").off();
			this.$el.find("#subscribe-button").remove();
		}
	}
});
