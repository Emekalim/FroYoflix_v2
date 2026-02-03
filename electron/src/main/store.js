import { join, dirname } from 'node:path'
import { mkdirSync, writeFileSync, readFileSync, unlinkSync, existsSync } from 'node:fs'

class Store {
  /**
   * @param {string} path
   * @param {string} fileName
   * @param {{}} defaults
   */
  constructor (path, fileName, defaults) {
    this.path = join(path, fileName)
    this.data = parseDataFile(this.path, defaults || {})
  }

  /**
   * @param {string} key
   */
  get (key) {
    return this.data[key]
  }

  /**
   * @param {string} key
   * @param {string} val
   */
  set (key, val) {
    this.data[key] = val
    writeFileSync(this.path, JSON.stringify(this.data))
  }

  /**
   * Resets the store to its default values.
   */
  reset() {
    this.data = {}
    writeFileSync(this.path, JSON.stringify(this.data))
  }

  /**
   * Deletes the JSON file completely.
   */
  delete() {
    if (existsSync(this.path)) unlinkSync(this.path)
  }
}

/**
 * @param {import("fs").PathOrFileDescriptor} filePath
 * @param {any} defaults
 */
function parseDataFile (filePath, defaults) {
  try {
    if (!existsSync(dirname(filePath))) mkdirSync(dirname(filePath), { recursive: true })
    return { ...defaults || {}, ...JSON.parse(readFileSync(filePath).toString()) }
  } catch (error) {
    return defaults || {}
  }
}

export default Store
