/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/

"use strict";

/**
 * @typedef {object} MapOptions
 * @property {boolean=} columns need columns?
 * @property {boolean=} module is module
 */

/**
 * @typedef {object} RawSourceMap
 * @property {number} version version
 * @property {string[]} sources sources
 * @property {string[]} names names
 * @property {string=} sourceRoot source root
 * @property {string[]=} sourcesContent sources content
 * @property {string} mappings mappings
 * @property {string} file file
 * @property {string=} debugId debug id
 * @property {number[]=} ignoreList ignore list
 */

/** @typedef {string | Buffer} SourceValue */

/**
 * @typedef {object} SourceAndMap
 * @property {SourceValue} source source
 * @property {RawSourceMap | null} map map
 */

/**
 * @typedef {object} HashLike
 * @property {(data: string | Buffer, inputEncoding?: string) => HashLike} update make hash update
 * @property {(encoding?: string) => string | Buffer} digest get hash digest
 */

class Source {
	/**
	 * @returns {SourceValue} source
	 */
	source() {
		throw new Error("Abstract");
	}

	buffer() {
		const source = this.source();
		if (Buffer.isBuffer(source)) return source;
		return Buffer.from(source, "utf8");
	}

	size() {
		return this.buffer().length;
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
	 * @param {MapOptions=} options map options
	 * @returns {SourceAndMap} source and map
	 */
	sourceAndMap(options) {
		return {
			source: this.source(),
			map: this.map(options),
		};
	}

	/**
	 * @param {HashLike} hash hash
	 * @returns {void}
	 */
	// eslint-disable-next-line no-unused-vars
	updateHash(hash) {
		throw new Error("Abstract");
	}

	/**
	 * Streams the source content to a WritableStream without allocating extra memory.
	 * Honors backpressure from the stream.
	 * @param {WritableStream} writableStream the stream to write to
	 * @param {(error?: Error) => void} callback callback called when streaming is complete
	 * @returns {void}
	 */
	streamTo(writableStream, callback) {
		const source = this.source();
		const buffer = Buffer.isBuffer(source) ? source : Buffer.from(source, "utf8");
		
		const writer = writableStream.getWriter();
		
		// Write the entire buffer at once - the promise will handle backpressure automatically
		writer
			.write(buffer)
			.then(() => {
				return writer.close();
			})
			.then(() => {
				writer.releaseLock();
				callback();
			})
			.catch((error) => {
				writer.abort().catch(() => {
					// Ignore abort errors
				});
				writer.releaseLock();
				callback(error);
			});
	}
}

module.exports = Source;
