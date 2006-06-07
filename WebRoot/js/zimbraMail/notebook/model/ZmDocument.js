/*
 * ***** BEGIN LICENSE BLOCK *****
 * Version: ZPL 1.2
 *
 * The contents of this file are subject to the Zimbra Public License
 * Version 1.2 ("License"); you may not use this file except in
 * compliance with the License. You may obtain a copy of the License at
 * http://www.zimbra.com/license
 *
 * Software distributed under the License is distributed on an "AS IS"
 * basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See
 * the License for the specific language governing rights and limitations
 * under the License.
 *
 * The Original Code is: Zimbra Collaboration Suite Web Client
 *
 * The Initial Developer of the Original Code is Zimbra, Inc.
 * Portions created by Zimbra are Copyright (C) 2006 Zimbra, Inc.
 * All Rights Reserved.
 *
 * Contributor(s):
 *
 * ***** END LICENSE BLOCK *****
 */

function ZmDocument(appCtxt, id, list) {
	if (arguments.length == 0) return;
	ZmItem.call(this, appCtxt, ZmItem.DOCUMENT, id, list);
	this.folderId = ZmDocument.DEFAULT_FOLDER;
}
ZmDocument.prototype = new ZmItem;
ZmDocument.prototype.constructor = ZmDocument;

ZmDocument.prototype.toString = function() {
	return "ZmDocument";
};

// Constants

ZmDocument.DEFAULT_FOLDER = ZmOrganizer.ID_NOTEBOOK;

// Data

ZmDocument.prototype.name;
ZmDocument.prototype.contentType;
ZmDocument.prototype.creator;
ZmDocument.prototype.createDate;
ZmDocument.prototype.modifier;
ZmDocument.prototype.modifyDate;
ZmDocument.prototype.size;
ZmDocument.prototype.version = 0;

// Static functions

ZmDocument.createFromDom = function(node, args) {
	var doc = new ZmDocument(args.appCtxt, null, args.list);
	doc.set(node);
	return doc;
};

// Public methods

ZmDocument.prototype.set = function(data) {
	// ZmItem fields
	this.id = data.id;
	this.url = data.url;
	// REVISIT: Sometimes the server doesn't return the folderId!!!
	this.folderId = data.l || this.folderId;
	this._parseTags(data.t);

	// ZmDocument fields
	this.name = data.name;
	this.contentType = data.ct;
	this.creator = data.cr;
	this.createDate = new Date(Number(data.d));
	this.modifier = data.leb;
	this.modifyDate = new Date(Number(data.md));
	this.size = Number(data.s);
	this.version = Number(data.ver);
};
