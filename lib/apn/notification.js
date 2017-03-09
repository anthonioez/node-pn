"use strict";
/**
 * Create a notification
 * @constructor
 */
function Notification () 
{
	this.encoding = "utf8";

	this.aps = {};
	this.data = {};

	this.compiled = false;

	this.truncateAtWordEnd = false;
}

/**
 * @returns {Number} Byte length of the notification payload
 * @since v1.2.0
 */
Notification.prototype.length = function () 
{
	this.compiled = false;
	return Buffer.byteLength(this.compile(), this.encoding || "utf8");
};

/**
 * If the notification payload is too long to send this method will attempt to trim the alert body text.
 * @returns {Number} The number of characters removed from the body text. If a negative value is returned, the text is too short to be trimmed enough.
 * @since v1.2.0
 */
Notification.prototype.trim = function(length) 
{
	var payloadLength = this.length();
	var tooLong = payloadLength - (length || 4096);
	if(tooLong <= 0) 
	{
		return 0;
	}
	this.compiled = false;
	var encoding = this.encoding || "utf8";
	var escaped = this.getAlertText();

	if(!escaped) 
	{
		return -tooLong;
	}

	escaped = JSON.stringify(escaped).slice(1, -1); // trim quotes
	length = Buffer.byteLength(escaped, encoding);
	if (length < tooLong) 
	{
		return length - tooLong;
	}
	escaped = this.truncateStringToLength(escaped, length - tooLong, encoding);
	escaped = escaped.replace(/(\\u[0-9a-fA-F]{0,3})$/, "");
	escaped = escaped.replace(/\\+$/, function(a){ return a.length % 2 === 0 ? a : a.slice(0, -1); });

	var trimmed = Buffer.byteLength(escaped, encoding);
	escaped = JSON.parse("\"" + escaped + "\"");

	this.setAlertText(escaped);
	return length - trimmed;
};

function hasValidUnicodeTail(string, encoding) 
{
	var code = string.charCodeAt(string.length - 1);
	if (code !== 0xFFFD && encoding === "utf8") 
	{
		return true;
	}
	else if ((code < 0xD800 || code > 0xDBFF) && (encoding === "utf16le" || encoding === "ucs2")) 
	{
		return true;
	}
	return false;
}

/**
 * @param {String} [string] Unicode string to be truncated
 * @param {Number} [length] The maximum number of bytes permitted in the Unicode string
 * @returns {String} Truncated String
 * @private
 */
Notification.prototype.truncateStringToLength = function (string, length, encoding) 
{
	// Convert to a buffer and back to a string with the correct encoding to truncate the unicode series correctly.
	var result = new Buffer(string, encoding).toString(encoding, 0, length);

	if (this.truncateAtWordEnd === true) 
	{
		var lastSpaceIndexInResult = result.lastIndexOf(" ");

		if(lastSpaceIndexInResult !== -1 && string.charAt(result.length) !== " ")
		{
			result = result.substr(0, lastSpaceIndexInResult);
		}
	}

	// since we might have chopped off the end of a multi-byte sequence, remove any
	// invalid characters (represented as U+FFFD "REPLACEMENT CHARACTER") for UTF-8
	// or orphaned lead surrogates for UTF-16 (UCS-2) - where only the tail surrogate
	// has been removed.
	if (encoding === "utf8" || encoding === "utf16le" || encoding === "ucs2") 
	{
		while( result.length > 0 && !hasValidUnicodeTail(result, encoding) ) 
		{
			result = result.substr(0, result.length - 1);
		}
	}

	return result;
};

module.exports = Notification;
