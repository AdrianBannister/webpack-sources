/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/

"use strict";

const Source = require("./Source");
const streamChunksOfRawSource = require("./helpers/streamChunksOfRawSource");
const {
	internString,
	isDualStringBufferCachingEnabled,
} = require("./helpers/stringBufferUtils");

/** @typedef {import("./Source").HashLike} HashLike */
/** @typedef {import("./Source").MapOptions} MapOptions */
/** @typedef {import("./Source").RawSourceMap} RawSourceMap */
/** @typedef {import("./Source").SourceValue} SourceValue */
/** @typedef {import("./helpers/getGeneratedSourceInfo").GeneratedSourceInfo} GeneratedSourceInfo */
/** @typedef {import("./helpers/streamChunks").OnChunk} OnChunk */
/** @typedef {import("./helpers/streamChunks").OnName} OnName */
/** @typedef {import("./helpers/streamChunks").OnSource} OnSource */
/** @typedef {import("./helpers/streamChunks").Options} Options */

class RawSource extends Source {
	/**
	 * @param {string | Buffer} value value
	 * @param {boolean=} convertToString convert to string
	 */
	constructor(value, convertToString = false) {
		super();
		const isBuffer = Buffer.isBuffer(value);
		if (!isBuffer && typeof value !== "string") {
			throw new TypeError("argument 'value' must be either string or Buffer");
		}
		this._valueIsBuffer = !convertToString && isBuffer;
		const internedString =
			typeof value === "string" ? internString(value) : undefined;
		/**
		 * @private
		 * @type {undefined | string | Buffer}
		 */
		this._value =
			convertToString && isBuffer
				? undefined
				: typeof value === "string"
					? internedString
					: value;
		/**
		 * @private
		 * @type {undefined | Buffer}
		 */
		this._valueAsBuffer = isBuffer ? value : undefined;
		/**
		 * @private
		 * @type {undefined | string}
		 */
		this._valueAsString = isBuffer ? undefined : internedString;
	}

	isBuffer() {
		return this._valueIsBuffer;
	}

	/**
	 * @returns {SourceValue} source
	 */
	source() {
		if (this._value === undefined) {
			const value =
				/** @type {Buffer} */
				(this._valueAsBuffer).toString("utf8");
			if (isDualStringBufferCachingEnabled()) {
				this._value = internString(value);
			}
			return value;
		}
		return this._value;
	}

	buffer() {
		if (this._valueAsBuffer === undefined) {
			const value = Buffer.from(/** @type {string} */ (this._value), "utf8");
			if (isDualStringBufferCachingEnabled()) {
				this._valueAsBuffer = value;
			}
			return value;
		}
		return this._valueAsBuffer;
	}

	/**
	 * @param {MapOptions=} options map options
	 * @returns {RawSourceMap | null} map
	 */
	// eslint-disable-next-line no-unused-vars
	map(options) {
		return null;
	}

	/**
	 * @param {Options} options options
	 * @param {OnChunk} onChunk called for each chunk of code
	 * @param {OnSource} onSource called for each source
	 * @param {OnName} onName called for each name
	 * @returns {GeneratedSourceInfo} generated source info
	 */
	streamChunks(options, onChunk, onSource, onName) {
		let strValue = this._valueAsString;
		if (strValue === undefined) {
			const value = this.source();
			strValue = typeof value === "string" ? value : value.toString("utf8");
			if (isDualStringBufferCachingEnabled()) {
				this._valueAsString = internString(strValue);
			}
		}
		return streamChunksOfRawSource(
			strValue,
			onChunk,
			onSource,
			onName,
			Boolean(options && options.finalSource),
		);
	}

	/**
	 * @param {NodeJS.WritableStream} writableStream the stream to write to
	 * @returns {Promise<void>} promise that resolves when streaming is complete
	 */
	async streamTo(writableStream) {
		// Use buffer if available, otherwise convert from string
		let buffer = this._valueAsBuffer;
		if (buffer === undefined) {
			// Try to use cached string first to avoid conversion
			const source = this._valueAsString;
			if (source !== undefined) {
				buffer = Buffer.from(source, "utf8");
			} else {
				// _value must be defined if _valueAsBuffer and _valueAsString are not
				const value = this._value;
				if (Buffer.isBuffer(value)) {
					buffer = value;
				} else {
					// Must be a string
					buffer = Buffer.from(/** @type {string} */ (value), "utf8");
				}
			}
		}
		
		return new Promise((resolve, reject) => {
			let offset = 0;
			
			const write = () => {
				while (offset < buffer.length) {
					const chunk = buffer.slice(offset, offset + 65536); // 64KB chunks
					const canContinue = writableStream.write(chunk);
					offset += chunk.length;
					
					if (!canContinue) {
						writableStream.once("drain", write);
						return;
					}
				}
				
				writableStream.end();
			};
			
			writableStream.on("error", reject);
			writableStream.on("finish", resolve);
			write();
		});
	}

	/**
	 * @param {HashLike} hash hash
	 * @returns {void}
	 */
	updateHash(hash) {
		hash.update("RawSource");
		hash.update(this.buffer());
	}
}

module.exports = RawSource;
