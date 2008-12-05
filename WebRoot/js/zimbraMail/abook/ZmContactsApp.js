/*
 * ***** BEGIN LICENSE BLOCK *****
 * 
 * Zimbra Collaboration Suite Web Client
 * Copyright (C) 2004, 2005, 2006, 2007 Zimbra, Inc.
 * 
 * The contents of this file are subject to the Yahoo! Public License
 * Version 1.0 ("License"); you may not use this file except in
 * compliance with the License.  You may obtain a copy of the License at
 * http://www.zimbra.com/license.
 * 
 * Software distributed under the License is distributed on an "AS IS"
 * basis, WITHOUT WARRANTY OF ANY KIND, either express or implied.
 * 
 * ***** END LICENSE BLOCK *****
 */

/**
 * Creates and initializes the contacts application.
 * @constructor
 * @class
 * The contacts app manages the creation and display of contacts, which are grouped
 * into address books.
 * 
 * @author Conrad Damon
 */
ZmContactsApp = function(container, parentController) {

	ZmApp.call(this, ZmApp.CONTACTS, container, parentController);

	var settings = appCtxt.getSettings();
	settings.addChangeListener(new AjxListener(this, this._settingsChangeListener));

	this.contactsLoaded = {};
	this._contactList = {};
	this._initialized = false;
	this._acRequests = {};
};

// Organizer and item-related constants
ZmEvent.S_CONTACT				= ZmId.ITEM_CONTACT;
ZmEvent.S_GROUP					= ZmId.ITEM_GROUP;
ZmItem.CONTACT					= ZmEvent.S_CONTACT;
ZmItem.GROUP					= ZmEvent.S_GROUP;
ZmOrganizer.ADDRBOOK			= ZmId.ORG_ADDRBOOK;

// App-related constants
ZmApp.CONTACTS							= ZmId.APP_CONTACTS;
ZmApp.CLASS[ZmApp.CONTACTS]				= "ZmContactsApp";
ZmApp.SETTING[ZmApp.CONTACTS]			= ZmSetting.CONTACTS_ENABLED;
ZmApp.UPSELL_SETTING[ZmApp.CONTACTS]	= ZmSetting.CONTACTS_UPSELL_ENABLED;
ZmApp.LOAD_SORT[ZmApp.CONTACTS]			= 30;
ZmApp.QS_ARG[ZmApp.CONTACTS]			= "contacts";

// autocomplete: choices for text in the returned match object
ZmContactsApp.AC_VALUE_FULL 	= "fullAddress";
ZmContactsApp.AC_VALUE_EMAIL	= "email";
ZmContactsApp.AC_VALUE_NAME		= "name";

// autocomplete: request control
ZmContactsApp.AC_MAX 			= 20;	// max # of autocomplete matches to return
ZmContactsApp.AC_TIMEOUT		= 15;	// autocomplete timeout (in seconds)

// autocomplete: icons
ZmContactsApp.AC_ICON = {};
ZmContactsApp.AC_ICON["contact"]	= "Contact";
ZmContactsApp.AC_ICON["gal"]		= "GALContact";
ZmContactsApp.AC_ICON["group"]		= "Group";

// autocomplete: things to match against
ZmContactsApp.AC_GAL		= "GAL";
ZmContactsApp.AC_LOCATION	= "Location";
ZmContactsApp.AC_EQUIPMENT	= "Equipment";

// search menu
ZmContactsApp.SEARCHFOR_CONTACTS 	= 1;
ZmContactsApp.SEARCHFOR_GAL 		= 2;
ZmContactsApp.SEARCHFOR_PAS			= 3; // PAS = personal and shared
ZmContactsApp.SEARCHFOR_MAX 		= 50;

ZmContactsApp.prototype = new ZmApp;
ZmContactsApp.prototype.constructor = ZmContactsApp;

ZmContactsApp.prototype.toString = 
function() {
	return "ZmContactsApp";
};

// Construction

ZmContactsApp.prototype._defineAPI =
function() {
	AjxDispatcher.setPackageLoadFunction("ContactsCore", new AjxCallback(this, this._postLoadCore));
	AjxDispatcher.setPackageLoadFunction("Contacts", new AjxCallback(this, this._postLoad, ZmOrganizer.ADDRBOOK));
	AjxDispatcher.registerMethod("GetContacts", "ContactsCore", new AjxCallback(this, this.getContactList));
	AjxDispatcher.registerMethod("GetContactListController", ["ContactsCore", "Contacts"], new AjxCallback(this, this.getContactListController));
	AjxDispatcher.registerMethod("GetContactController", ["ContactsCore", "Contacts"], new AjxCallback(this, this.getContactController));
};

ZmContactsApp.prototype._registerSettings =
function(settings) {
	var settings = settings || appCtxt.getSettings();
	settings.registerSetting("AUTO_ADD_ADDRESS",			{name: "zimbraPrefAutoAddAddressEnabled", type: ZmSetting.T_PREF, dataType: ZmSetting.D_BOOLEAN, defaultValue: false});
	settings.registerSetting("CONTACTS_PER_PAGE",			{name: "zimbraPrefContactsPerPage", type: ZmSetting.T_PREF, dataType: ZmSetting.D_INT, defaultValue: 25});
	settings.registerSetting("CONTACTS_VIEW",				{name: "zimbraPrefContactsInitialView", type: ZmSetting.T_PREF, defaultValue: ZmSetting.CV_LIST});
	settings.registerSetting("EXPORT",						{type: ZmSetting.T_PREF, dataType: ZmSetting.D_NONE});
	settings.registerSetting("GAL_AUTOCOMPLETE",			{name: "zimbraPrefGalAutoCompleteEnabled", type: ZmSetting.T_PREF, dataType: ZmSetting.D_BOOLEAN, defaultValue: false});
	settings.registerSetting("GAL_AUTOCOMPLETE_SESSION",	{type: ZmSetting.T_PREF, dataType: ZmSetting.D_BOOLEAN, defaultValue: true});
	settings.registerSetting("IMPORT",						{type: ZmSetting.T_PREF, dataType: ZmSetting.D_NONE});
	settings.registerSetting("MAX_CONTACTS",				{name: "zimbraContactMaxNumEntries", type: ZmSetting.T_COS, dataType: ZmSetting.D_INT, defaultValue: 0});
	settings.registerSetting("NEW_ADDR_BOOK_ENABLED",		{name: "zimbraFeatureNewAddrBookEnabled", type:ZmSetting.T_COS, dataType:ZmSetting.D_BOOLEAN, defaultValue:true});
};

ZmContactsApp.prototype._registerPrefs =
function() {
	var sections = {
		CONTACTS: {
			title: ZmMsg.addressBook,
			templateId: "prefs.Pages#Contacts",
			priority: 50,
			precondition: ZmSetting.CONTACTS_ENABLED,
			prefs: [
				ZmSetting.AUTO_ADD_ADDRESS,
				ZmSetting.CONTACTS_PER_PAGE,
				ZmSetting.CONTACTS_VIEW,
				ZmSetting.EXPORT,
				ZmSetting.GAL_AUTOCOMPLETE,
				ZmSetting.GAL_AUTOCOMPLETE_SESSION,
				ZmSetting.INITIALLY_SEARCH_GAL,
				ZmSetting.IMPORT
			]
		}
	};
	for (var id in sections) {
		ZmPref.registerPrefSection(id, sections[id]);
	}

	ZmPref.registerPref("AUTO_ADD_ADDRESS", {
		displayName:		ZmMsg.autoAddContacts,
		displayContainer:	ZmPref.TYPE_CHECKBOX
	});

	ZmPref.registerPref("CONTACTS_PER_PAGE", {
		displayName:		ZmMsg.contactsPerPage,
	 	displayContainer:	ZmPref.TYPE_SELECT,
		displayOptions:		["10", "25", "50", "100"]
	});

	ZmPref.registerPref("CONTACTS_VIEW", {
		displayName:		ZmMsg.viewContacts,
	 	displayContainer:	ZmPref.TYPE_SELECT,
		displayOptions:		[ZmMsg.detailedCards, ZmMsg.contactList],
		options:			[ZmSetting.CV_CARDS, ZmSetting.CV_LIST]
	});

	ZmPref.registerPref("EXPORT", {
		loadFunction:		ZmPref.loadCsvFormats,
		displayContainer:	ZmPref.TYPE_EXPORT
	});

	ZmPref.registerPref("GAL_AUTOCOMPLETE", {
		displayName:		ZmMsg.galAutocomplete,
		displayContainer:	ZmPref.TYPE_CHECKBOX,
		precondition:
			function() {
				return appCtxt.get(ZmSetting.GAL_AUTOCOMPLETE_ENABLED) &&
					   appCtxt.get(ZmSetting.GAL_ENABLED);
			}
	});

	ZmPref.registerPref("GAL_AUTOCOMPLETE_SESSION", {
		displayName:		ZmMsg.galAutocompleteSession,
		displayContainer:	ZmPref.TYPE_CHECKBOX,
		precondition:		ZmSetting.GAL_AUTOCOMPLETE
	});

	ZmPref.registerPref("IMPORT", {
		displayName:		ZmMsg.importFromCSV,
		displayContainer:	ZmPref.TYPE_IMPORT
	});

	ZmPref.registerPref("INITIALLY_SEARCH_GAL", {
		displayName:		ZmMsg.initiallySearchGal,
		displayContainer:	ZmPref.TYPE_CHECKBOX,
		precondition:		ZmSetting.GAL_ENABLED
	});
};

ZmContactsApp.prototype._registerOperations =
function() {
	ZmOperation.registerOp(ZmId.OP_CONTACT);	// placeholder
	ZmOperation.registerOp(ZmId.OP_EDIT_CONTACT, {textKey:"AB_EDIT_CONTACT", image:"Edit", shortcut:ZmKeyMap.EDIT});
	ZmOperation.registerOp(ZmId.OP_MOUNT_ADDRBOOK, {textKey:"mountAddrBook", image:"ContactsFolder"});
	ZmOperation.registerOp(ZmId.OP_NEW_ADDRBOOK, {textKey:"newAddrBook", tooltipKey:"newAddrBookTooltip", image:"NewContactsFolder"}, ZmSetting.NEW_ADDR_BOOK_ENABLED);
	ZmOperation.registerOp(ZmId.OP_NEW_CONTACT, {textKey:"newContact", tooltipKey:"newContactTooltip", image:"NewContact", shortcut:ZmKeyMap.NEW_CONTACT}, ZmSetting.CONTACTS_ENABLED);
	ZmOperation.registerOp(ZmId.OP_NEW_GROUP, {textKey:"newGroup", tooltipKey:"newGroupTooltip", image:"NewGroup"}, ZmSetting.CONTACTS_ENABLED);
	ZmOperation.registerOp(ZmId.OP_PRINT_CONTACT, {textKey:"printContact", image:"Print", shortcut:ZmKeyMap.PRINT}, ZmSetting.PRINT_ENABLED);
	ZmOperation.registerOp(ZmId.OP_PRINT_ADDRBOOK, {textKey:"printAddrBook", image:"Print"}, ZmSetting.PRINT_ENABLED);
	ZmOperation.registerOp(ZmId.OP_SHARE_ADDRBOOK, {textKey:"shareAddrBook", image:"SharedContactsFolder"});
	ZmOperation.registerOp(ZmId.OP_SHOW_ONLY_CONTACTS, {textKey:"showOnlyContacts", image:"Contact"}, ZmSetting.MIXED_VIEW_ENABLED);
};

ZmContactsApp.prototype._registerItems =
function() {
	ZmItem.registerItem(ZmItem.CONTACT,
						{app:			ZmApp.CONTACTS,
						 nameKey:		"contact",
						 icon:			"Contact",
						 soapCmd:		"ContactAction",
						 itemClass:		"ZmContact",
						 node:			"cn",
						 organizer:		ZmOrganizer.ADDRBOOK,
						 dropTargets:	[ZmOrganizer.TAG, ZmOrganizer.ZIMLET, ZmOrganizer.ADDRBOOK],
						 searchType:	"contact",
						 resultsList:
		AjxCallback.simpleClosure(function(search) {
			AjxDispatcher.require("ContactsCore");
			return new ZmContactList(search, search ? search.isGalSearch || search.isGalAutocompleteSearch : null);
		}, this)
						});

	ZmItem.registerItem(ZmItem.GROUP,
						{nameKey:	"group",
						 icon:		"Group",
						 soapCmd:	"ContactAction"
						});
};

ZmContactsApp.prototype._registerOrganizers =
function() {
	var orgColor = {};
	orgColor[ZmFolder.ID_AUTO_ADDED] = ZmOrganizer.C_YELLOW;
	
	ZmOrganizer.registerOrg(ZmOrganizer.ADDRBOOK,
							{app:				ZmApp.CONTACTS,
							 nameKey:			"addressBook",
							 defaultFolder:		ZmOrganizer.ID_ADDRBOOK,
							 soapCmd:			"FolderAction",
							 firstUserId:		256,
							 orgClass:			"ZmAddrBook",
							 orgPackage:		"ContactsCore",
							 treeController:	"ZmAddrBookTreeController",
							 labelKey:			"addressBooks",
							 itemsKey:			"contacts",
							 hasColor:			true,
							 defaultColor:		ZmOrganizer.C_GRAY,
							 orgColor:			orgColor,
							 treeType:			ZmOrganizer.FOLDER,
							 dropTargets:		[ZmOrganizer.ADDRBOOK],
							 views:				["contact"],
							 folderKey:			"addressBookFolder",
							 mountKey:			"mountAddrBook",
							 createFunc:		"ZmOrganizer.create",
							 compareFunc:		"ZmAddrBook.sortCompare",
							 displayOrder:		100,
							 newOp:             ZmOperation.NEW_ADDRBOOK,
							 deferrable:		true
							});
};

ZmContactsApp.prototype._setupSearchToolbar =
function() {
	ZmSearchToolBar.addMenuItem(ZmItem.CONTACT,
								{msgKey:		"searchContacts",
								 tooltipKey:	"searchPersonalContacts",
								 icon:			"ContactsFolder",
								 shareIcon:		"SharedContactsFolder",
								 id:			ZmId.getMenuItemId(ZmId.SEARCH, ZmId.ITEM_CONTACT)
								});

	ZmSearchToolBar.addMenuItem(ZmId.SEARCH_GAL,
								{msgKey:		"searchGALContacts",
								 tooltipKey:	"searchGALContacts",
								 icon:			"GAL",
								 setting:		ZmSetting.GAL_ENABLED,
								 id:			ZmId.getMenuItemId(ZmId.SEARCH, ZmId.SEARCH_GAL)
								});
};

ZmContactsApp.prototype._registerApp =
function() {
	var newItemOps = {};
	newItemOps[ZmOperation.NEW_CONTACT]	= "contact";
	newItemOps[ZmOperation.NEW_GROUP]	= "group";

	var newOrgOps = {};
	newOrgOps[ZmOperation.NEW_ADDRBOOK] = "addressBook";

	var actionCodes = {};
	actionCodes[ZmKeyMap.NEW_CONTACT] = ZmOperation.NEW_CONTACT;

	ZmApp.registerApp(ZmApp.CONTACTS,
							 {mainPkg:				"Contacts",
							  nameKey:				"addressBook",
							  icon:					"ContactsApp",
							  chooserTooltipKey:	"goToContacts",
							  viewTooltipKey:		"displayContacts",
							  defaultSearch:		ZmItem.CONTACT,
							  organizer:			ZmOrganizer.ADDRBOOK,
							  overviewTrees:		[ZmOrganizer.ADDRBOOK, ZmOrganizer.ROSTER_TREE_ITEM, ZmOrganizer.SEARCH, ZmOrganizer.TAG],
							  showZimlets:			true,
							  assistants:			{"ZmContactAssistant":["ContactsCore", "Contacts"]},
							  searchTypes:			[ZmItem.CONTACT],
							  newItemOps:			newItemOps,
							  newOrgOps:			newOrgOps,
							  actionCodes:			actionCodes,
							  gotoActionCode:		ZmKeyMap.GOTO_CONTACTS,
							  newActionCode:		ZmKeyMap.NEW_CONTACT,
							  trashViewOp:			ZmOperation.SHOW_ONLY_CONTACTS,
							  chooserSort:			20,
							  defaultSort:			40,
							  upsellUrl:			ZmSetting.CONTACTS_UPSELL_URL,
							  supportsMultiMbox:	true
							  });
};


// App API

/*
ZmContactsApp.prototype.startup =
function(result) {
	AjxDispatcher.run("GetContacts");
};
*/

/**
 * Checks for the creation of an address book or a mount point to one. Regular
 * contact creates are handed to the canonical list.
 * 
 * @param creates	[hash]		hash of create notifications
 */
ZmContactsApp.prototype.createNotify =
function(creates, force) {
	if (!creates["folder"] && !creates["cn"] && !creates["link"]) { return; }
	if (!force && !this._noDefer && this._deferNotifications("create", creates)) { return; }

	for (var name in creates) {
		var list = creates[name];
		for (var i = 0; i < list.length; i++) {
			var create = list[i];
			if (appCtxt.cacheGet(create.id)) { continue; }
	
			if (name == "folder") {
				this._handleCreateFolder(create, ZmOrganizer.ADDRBOOK);
			} else if (name == "link") {
				this._handleCreateLink(create, ZmOrganizer.ADDRBOOK);
			} else if (name == "cn") {
				DBG.println(AjxDebug.DBG1, "ZmContactsApp: handling CREATE for node: " + name);
				// find out if we're dealing with shared contact
				var folder = appCtxt.getById(create.l);
				if (folder && folder.isRemote()) {
					var clc = AjxDispatcher.run("GetContactListController");

					var newPid = ZmOrganizer.parseId(folder.id);
					var curPid = ZmOrganizer.parseId(clc._folderId);
					if (newPid.id == curPid.id && newPid.account == curPid.account) {
						clc.getList().notifyCreate(create);
					}
				} else {
					AjxDispatcher.run("GetContacts").notifyCreate(create);
				}
				create._handled = true;
			}
		}
	}
};

ZmContactsApp.prototype.postNotify =
function(notify) {
	if (this._checkReplenishListView) {
		this._checkReplenishListView._checkReplenish();
		this._checkReplenishListView = null;
	}
};

ZmContactsApp.prototype.refresh =
function(refresh) {
	this._handleRefresh();
};

ZmContactsApp.prototype.handleOp =
function(op) {
	switch (op) {
		case ZmOperation.NEW_CONTACT:
		case ZmOperation.NEW_GROUP: {
			var type = (op == ZmOperation.NEW_GROUP) ? ZmItem.GROUP : null;
			var contact = new ZmContact(null, null, type);
			var loadCallback = new AjxCallback(this, this._handleLoadNewItem, [contact]);
			AjxDispatcher.require(["ContactsCore", "Contacts"], false, loadCallback, null, true);
			break;
		}
		case ZmOperation.NEW_ADDRBOOK: {
			var loadCallback = new AjxCallback(this, this._handleLoadNewAddrBook);
			AjxDispatcher.require(["ContactsCore", "Contacts"], false, loadCallback, null, true);
			break;
		}
	}
};

ZmContactsApp.prototype._handleLoadNewItem =
function(contact) {
	AjxDispatcher.run("GetContactController").show(contact);
};

ZmContactsApp.prototype._handleLoadNewAddrBook =
function() {
	appCtxt.getAppViewMgr().popView(true, ZmId.VIEW_LOADING);	// pop "Loading..." page
	var dialog = appCtxt.getNewAddrBookDialog();
	if (!this._newAddrBookCb) {
		this._newAddrBookCb = new AjxCallback(this, this._newAddrBookCallback);
	}
	ZmController.showDialog(dialog, this._newAddrBookCb);
};

// Public methods

ZmContactsApp.prototype.launch =
function(params, callback) {
	var loadCallback = new AjxCallback(this, this._handleLoadLaunch, [callback]);
	AjxDispatcher.require(["ContactsCore", "Contacts"], true, loadCallback, null, true);
};

ZmContactsApp.prototype._handleLoadLaunch =
function(callback) {
	// contacts should already be loaded
	var respCallback = new AjxCallback(this, this._handleLoadLaunchResponse, callback);
	var contactList = this.getContactList(respCallback);
	if (contactList && !contactList.isLoaded) {
		contactList.addLoadedCallback(new AjxCallback(this, this._showContactList));
	}
};

ZmContactsApp.prototype._handleLoadLaunchResponse =
function(callback) {
	var clc = AjxDispatcher.run("GetContactListController");
	if (!this._initialized) {
		// set search toolbar field manually
		if (appCtxt.get(ZmSetting.SHOW_SEARCH_STRING)) {
			var folder = appCtxt.getById(ZmFolder.ID_CONTACTS);
			if (folder) {
				this.currentQuery = folder.createQuery();
			}
		}
		// create contact view for the first time
		this._showContactList();
	} else {
		// just push the view so it looks the same as last you saw it
		clc.switchView(clc._getViewType(), true, this._initialized);
	}

	if (callback) {
		callback.run();
	}

	this._initialized = true;
};

ZmContactsApp.prototype._showContactList =
function() {
	var clc = AjxDispatcher.run("GetContactListController");
	var acctId = appCtxt.getActiveAccount().id;
	clc.show(this._contactList[acctId], null, ZmOrganizer.ID_ADDRBOOK);
};

ZmContactsApp.prototype.showSearchResults =
function(results, callback, isInGal, folderId) {
	var loadCallback = new AjxCallback(this, this._handleLoadShowSearchResults, [results, callback, isInGal, folderId]);
	AjxDispatcher.require("Contacts", false, loadCallback, null, true);
};

ZmContactsApp.prototype._handleLoadShowSearchResults =
function(results, callback, isInGal, folderId) {
	this.getContactListController().show(results, isInGal, folderId);
	if (callback) {
		callback.run();
	}
};

ZmContactsApp.prototype._activateAccordionItem =
function(accordionItem) {
	ZmApp.prototype._activateAccordionItem.call(this, accordionItem);

	// ensure contact list is loaded for the currently active account

	var callback = (this._appViewMgr.getCurrentViewId() != ZmId.VIEW_GROUP)
		? new AjxCallback(this, this._handleResponseActivateAccordion) : null;
	this.getContactList(callback);
};

ZmContactsApp.prototype._handleResponseActivateAccordion =
function(contactList) {
	var fid = ZmOrganizer.getSystemId(ZmFolder.ID_CONTACTS);
	var folder = appCtxt.getById(fid);

	if (appCtxt.getAppViewMgr().getCurrentViewId() == ZmId.VIEW_CONTACT) {
		return;
	}

	if (folder) {
		this.showFolder(folder);

		var clc = AjxDispatcher.run("GetContactListController");
		clc.getParentView().getAlphabetBar().reset();

		var oc = appCtxt.getOverviewController();
		var tv = oc.getTreeController(ZmOrganizer.ADDRBOOK).getTreeView(this.getOverviewId());
		tv.setSelected(folder, true);
	}
};

ZmContactsApp.prototype.showFolder =
function(folder) {
	// we manually set search bar's field since contacts dont always make search requests
	if (appCtxt.get(ZmSetting.SHOW_SEARCH_STRING)) {
		var query = folder.createQuery();
		var stb = appCtxt.getSearchController().getSearchToolbar();
		if (stb) {
			stb.setSearchFieldValue(query);
		}
	}
	var acctId = appCtxt.getActiveAccount().id;
	var clc = AjxDispatcher.run("GetContactListController");
	clc.show(this._contactList[acctId], null, folder.id);
};

ZmContactsApp.prototype.setActive =
function(active) {
	if (active) {
		var clc = AjxDispatcher.run("GetContactListController");
		clc.show();
	}
};

ZmContactsApp.prototype.isContactListLoaded =
function(acctId) {
	var aid = (acctId || appCtxt.getActiveAccount().id);
	return (this._contactList[aid] && this._contactList[aid].isLoaded);
};

ZmContactsApp.prototype.getContactList =
function(callback, errorCallback) {
	var acctId = appCtxt.getActiveAccount().id;
	if (!this._contactList[acctId]) {
		try {
			// check if a parent controller exists and ask it for the contact list
			if (this._parentController) {
				this._contactList[acctId] = this._parentController.getApp(ZmApp.CONTACTS).getContactList();
			} else {
				this._contactList[acctId] = new ZmContactList(null);
				var respCallback = new AjxCallback(this, this._handleResponseGetContactList, [callback]);
				this._contactList[acctId].load(respCallback, errorCallback);
			}
			return this._contactList[acctId];
		} catch (ex) {
			this._contactList[acctId] = null;
			throw ex;
		}
	} else {
		if (callback && callback.run) {
			callback.run(this._contactList[acctId]);
		}
		return this._contactList[acctId];
	}
};

ZmContactsApp.prototype._handleResponseGetContactList =
function(callback) {
	var acctId = appCtxt.getActiveAccount().id;
	this.contactsLoaded[acctId] = true;

	if (callback && callback.run) {
		callback.run(this._contactList[acctId]);
	}
};

// NOTE: calling method should handle exceptions!
ZmContactsApp.prototype.getGalContactList =
function() {
	if (!this._galContactList) {
		try {
			this._galContactList = new ZmContactList(null, true);
			this._galContactList.load();
		} catch (ex) {
			this._galContactList = null;
			throw ex;
		}
	}
	return this._galContactList;
};

ZmContactsApp.prototype.createFromVCard =
function(msgId, vcardPartId) {
	var contact = new ZmContact(null);
	contact.createFromVCard(msgId, vcardPartId);
};

ZmContactsApp.prototype.getContactListController =
function() {
	if (!this._contactListController) {
		this._contactListController = new ZmContactListController(this._container, this);
	}
	return this._contactListController;
};

ZmContactsApp.prototype.getContactController =
function() {
	if (this._contactController == null) {
		this._contactController = new ZmContactController(this._container, this);
	}
	return this._contactController;
};

ZmContactsApp.prototype._newAddrBookCallback =
function(parent, name, color) {
	// REVISIT: Do we really want to close the dialog before we
	//          know if the create succeeds or fails?
	var dialog = appCtxt.getNewAddrBookDialog();
	dialog.popdown();

	var oc = appCtxt.getOverviewController();
	oc.getTreeController(ZmOrganizer.ADDRBOOK)._doCreate(parent, name, color);
};

/**
 * Settings listener.
 */
ZmContactsApp.prototype._settingsChangeListener =
function(ev) {
	if (ev.type != ZmEvent.S_SETTINGS) { return; }
	if (!this._initialized) { return; }
	var clc = this.getContactListController();
	if (!clc) { return; }

	var list = ev.getDetail("settings");
	if (!(list && list.length)) { return; }

	var force = ((list.length == 1) && (list[0].id == ZmSetting.CONTACTS_PER_PAGE));
	var view = clc._getViewType();
	if (!force) {
		for (var i = 0; i < list.length; i++) {
			var setting = list[i];
			if (setting.id == ZmSetting.CONTACTS_VIEW) {
				view = clc._defaultView();
			}
		}
	}

	clc.switchView(view, force, this._initialized, true);
};

/**
 * Returns a list of matching contacts for a given string. The first name, last
 * name, full name, first/last name, and email addresses are matched against.
 *
 * @param str		[string]					string to match against
 * @param callback	[AjxCallback]				callback to run with results
 * @param aclv		[ZmAutocompleteListView]*	needed to show wait msg
 * @param options	[hash]*						additional options:
 *        folders	[list]*						list of folders to search in
 */
ZmContactsApp.prototype.autocompleteMatch =
function(str, callback, aclv, options) {

	str = str.toLowerCase();
	this._curAcStr = str;
	DBG.println("ac", "begin autocomplete for " + str);

	if (options && options.folders) {
		options.folderHash = {};
		for (var i = 0; i < options.folders.length; i++) {
			options.folderHash[options.folders[i]] = true;
		}
	}

	aclv.setWaiting(true);
	var respCallback = new AjxCallback(this, this._handleResponseAutocompleteMatch, [str, callback]);
	this._doAutocomplete(str, aclv, options, respCallback);
};

ZmContactsApp.prototype._handleResponseAutocompleteMatch =
function(str, callback, list) {
	// return results - we check str against curAcStr because we want to make sure
	// that we're returning results for the most recent (current) query
	if (str == this._curAcStr) {
		callback.run(list);
	}
};

/*
 * Fetches autocomplete matches for the given string from the server.
 *
 * @param str		[string]					string to match against
 * @param aclv		[ZmAutocompleteListView]	autocomplete popup
 * @param options
 * @param callback	[AjxCallback]				callback to run with results
 */
ZmContactsApp.prototype._doAutocomplete =
function(str, aclv, options, callback) {
	// cancel any outstanding requests for strings that are substrings of this one
	for (var substr in this._acRequests) {
		if (str != substr && str.indexOf(substr) === 0) {
			DBG.println("ac", "canceling autocomplete request for '" + substr + "' due to request for '" + str + "'");
			appCtxt.getAppController().cancelRequest(this._acRequests[substr], null, true);
			delete this._acRequests[str];
		}
	}

	var params = {query:str, limit:ZmContactsApp.AC_MAX, isAutocompleteSearch:true};
	var folders = options && options.folderHash;
	if (folders && (folders[ZmContactsApp.AC_GAL] || folders[ZmContactsApp.AC_LOCATION] || folders[ZmContactsApp.AC_EQUIPMENT])) {
		params.isGalAutocompleteSearch = true;
		params.isAutocompleteSearch = false;
		if (folders[ZmContactsApp.AC_LOCATION] || folders[ZmContactsApp.AC_EQUIPMENT]) {
			params.limit = params.limit * 2;
			params.types = AjxVector.fromArray([ZmItem.CONTACT]);
			params.galType = ZmSearch.GAL_RESOURCE;
		}
	}
	var search = new ZmSearch(params);
	var respCallback = new AjxCallback(this, this._handleResponseDoAutocomplete, [str, aclv, options, callback]);
	var errorCallback = new AjxCallback(this, this._handleErrorDoAutocomplete, [str, aclv]);
	this._acRequests[str] = search.execute({callback:respCallback, errorCallback:errorCallback,
											timeout:ZmContactsApp.AC_TIMEOUT, noBusyOverlay:true});
};

ZmContactsApp.prototype._handleResponseDoAutocomplete =
function(str, aclv, options, callback, result) {

	DBG.println("ac", "got response for " + str);

	// if we get back results for other than the current string, ignore them
	if (str != this._curAcStr) { return; }

	aclv.setWaiting(false);

	delete this._acRequests[str];

	var resultList, gotContacts = false;
	var resp = result.getResponse();
	if (resp && resp.search && resp.search.isGalAutocompleteSearch) {
		var cl = resp.getResults(ZmItem.CONTACT);
		resultList = (cl && cl.getArray()) || [];
		gotContacts = true;
	} else {
		resultList = resp._respEl.match || [];
	}

	DBG.println("ac", resultList.length + " matches");

	var list = [];
	for (var i = 0; i < resultList.length; i++) {
		var m = resultList[i];
		var match = {};
		if (gotContacts) {
			// if we got back a resource, check the type (we always get back both types)
			var resType = ZmContact.getAttr(m, ZmResource.F_type);
			var folders = (options && options.folderHash) || {};
			if (resType && !folders[resType]) { continue; }
			
			match.text = match.name = m.getFullName();
			match.email = m.getEmail();
			match.item = m;
		} else {
			var email = AjxEmailAddress.parse(m.email);
			match.fullAddress = email.toString();
			match.name = email.getName();
			match.email = email.getAddress();
			match.text = AjxStringUtil.htmlEncode(m.email);
			match.icon = ZmContactsApp.AC_ICON[m.type];
			match.score = m.ranking;
			if (options && options.needItem) {
				match.item = new ZmContact(null);
				match.item.initFromEmail(email);
			}
		}
		list.push(match);
	}

	callback.run(list);
};

/**
 * Handle timeout.
 */
ZmContactsApp.prototype._handleErrorDoAutocomplete =
function(str, aclv, ex) {
	DBG.println("ac", "error on request for " + str + ", canceling");
	aclv.setWaiting(false);
	appCtxt.getAppController().cancelRequest(this._acRequests[str], null, true);
	appCtxt.setStatusMsg(ZmMsg.autocompleteFailed);
	delete this._acRequests[str];

	return true;
};

/**
 * Sort autocomplete list by ranking scores (based on frequency as a recipient).
 */
ZmContactsApp.acSortCompare =
function(a, b) {
	var aScore = (a && a.score) || 0;
	var bScore = (b && b.score) || 0;
	return (aScore > bScore) ? 1 : (aScore < bScore) ? -1 : 0;
};


/**
 * Returns true if the given string is a valid email.
 *
 * @param str	[string]	a string
 */
ZmContactsApp.prototype.isComplete =
function(str) {
	return AjxEmailAddress.isValid(str);
};

/**
 * Quick completion of a string when there are no matches. Appends the
 * user's domain to the given string.
 *
 * @param str	[string]	text that was typed in
 */
ZmContactsApp.prototype.quickComplete =
function(str) {
	if (str.indexOf("@") != -1) {
		return null;
	} else if (this.type == ZmItem.RESOURCE) {
		return null;
	}
	var result = {};
	if (!this._userDomain) {
		var uname = appCtxt.get(ZmSetting.USERNAME);
		if (uname) {
			var a = uname.split("@");
			if (a && a.length) {
				this._userDomain = a[a.length - 1];
			}
		}
	}
	if (this._userDomain) {
		var text = [str, this._userDomain].join("@");
		result[ZmContactsApp.AC_VALUE_FULL] = text;
		result[ZmContactsApp.AC_VALUE_EMAIL] = text;
		result[ZmContactsApp.AC_VALUE_NAME] = text;
		return result;
	} else {
		return null;
	}
};
