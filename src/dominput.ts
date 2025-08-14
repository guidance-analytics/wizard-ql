/// <reference lib='dom' />
/// <reference lib='dom.iterable' />

import { type Token, type TypeRecord, ARRAY_DELIMITERS, BRACKETS, NEGATORS, OPERATION_ALIAS_DICTIONARY, OPERATION_PURPOSE_DICTIONARY, PARENS } from './spec'
import { type ExpressionConstraints, QUOTE_EDGE_REGEX, parse, tokenize } from './parse'
import { ConstraintError, ParseError } from './errors'

interface DOMInputOptions<T extends TypeRecord, V extends boolean> {
  input: HTMLElement
  constraints?: ExpressionConstraints<T, V>
  onUpdate?: (expression: ReturnType<typeof parse<T, V>> | ParseError | ConstraintError, tokens: Token[], string: string) => void
  parseOnInitialize?: boolean
}

/**
 * Get the absolute index of the user's cursor in an element with multiple nodes
 * @returns The index
 */
function getCursorIndex (element: HTMLElement): number {
  const selection = window.getSelection()
  const cursorNode = selection?.anchorNode
  const cursorOffset = selection?.anchorOffset

  if (!cursorNode || !element.contains(cursorNode)) return -1

  let absoluteIndex = 0
  if (cursorOffset) {
    for (const node of element.childNodes) {
      if (node.contains(cursorNode)) {
        absoluteIndex += (node.textContent?.length ?? 0) - (cursorNode.textContent?.length ?? 0)
        absoluteIndex += cursorOffset
        break
      } else absoluteIndex += (node.textContent?.length ?? 0)
    }
  }

  return absoluteIndex
}

/**
 * Set the user's index within an element with multiple text nodes
 * @param element The element to focus
 * @param index   The index to set
 */
function setCursor (element: HTMLElement, index: number): void {
  const selection = window.getSelection()

  let accumulated = 0
  for (const node of element.childNodes) {
    const length = node.textContent?.length ?? 0

    if (accumulated + length >= index) {
      selection?.setPosition(index > 0 ? node.childNodes.item(0) : node, index - accumulated)
      break
    } else accumulated += length
  }
}

/**
 * Initialize an element to become a Wizard langugae input
 * @warn This is a DOM function that is not meant for the backend
 * @returns A destroy function (destroys listening and functionality, not the element)
 */
export function createDOMInput<const T extends TypeRecord, const V extends boolean> ({ input, constraints, onUpdate, parseOnInitialize }: DOMInputOptions<T, V>): () => void {
  const history: Array<{ text: string, cursor: number }> = []
  let historyIndex = -1

  let savedCursor: number | undefined
  function update (): void {
    const focused = input.contains(document.activeElement)

    const text = input.textContent!.replaceAll('\n', '')
    const endPadding = input.textContent?.match(/\s*$/)?.[0].length ?? 0

    const newTokens = tokenize(text)
    const lastToken = newTokens.at(-1)
    if (lastToken && lastToken.content in OPERATION_ALIAS_DICTIONARY && focused && (!endPadding && lastToken.content.match(/^[A-Za-z]+?$/))) return

    const absoluteIndex = focused ? getCursorIndex(input) : 0

    observer.disconnect()
    let inArray: string | undefined
    let offset = 0
    for (let t = 0; t < newTokens.length; ++t) { // Add new nodes
      const token = newTokens[t]!
      const prior = newTokens[t - 1]
      const differenceFromLast = prior ? token.index - (prior.index + prior.content.length) : token.index

      if (differenceFromLast > 0) {
        const spacer = document.createElement('span')
        spacer.textContent = ' '.repeat(differenceFromLast)
        spacer.classList.add('whitespace-pre')
        spacer.toggleAttribute('data-spacer', true)

        const existing = input.childNodes.item(t + offset) as ChildNode | null
        if (existing) input.replaceChild(spacer, existing)
        else input.appendChild(spacer)
        ++offset
      }

      const element = document.createElement('span')
      element.textContent = token.content
      element.toggleAttribute('data-node', true)
      if (token.content.match(QUOTE_EDGE_REGEX)) element.toggleAttribute('data-quoted', true)
      if (!isNaN(Number(token.content))) element.toggleAttribute('data-number', true)
      if (PARENS.concat(BRACKETS).some((entry) => entry.includes(token.content))) {
        if (inArray && BRACKETS.some(([o, c]) => (inArray === o && token.content === c))) inArray = undefined
        if (!inArray) element.setAttribute('data-bracket', token.content)
        if (!inArray && BRACKETS.some(([o]) => o === token.content)) inArray = token.content
      }
      if (inArray && ARRAY_DELIMITERS.includes(token.content)) element.toggleAttribute('data-delimiter', true)
      if (!inArray && NEGATORS.includes(token.content)) element.toggleAttribute('data-negation', true)
      if (!inArray && token.content in OPERATION_ALIAS_DICTIONARY) {
        element.setAttribute('data-operation', OPERATION_PURPOSE_DICTIONARY[OPERATION_ALIAS_DICTIONARY[token.content as keyof typeof OPERATION_ALIAS_DICTIONARY]])
      }

      const existing = input.childNodes.item(t + offset) as ChildNode | null
      if (existing) input.replaceChild(element, existing)
      else input.appendChild(element)
    }

    // Delete old extra nodes
    while (newTokens.length + offset < input.childNodes.length) input.lastChild?.remove()

    const last = input.lastElementChild
    if (last?.tagName === 'BR') last.remove()

    if (endPadding) {
      const spacer = document.createElement('span')
      spacer.textContent = ' '.repeat(endPadding)
      spacer.classList.add('whitespace-pre')
      spacer.toggleAttribute('data-spacer', true)
      input.appendChild(spacer)
    }

    observer.observe(input, { characterData: true, childList: true, subtree: true })

    if (focused) setCursor(input, savedCursor ?? absoluteIndex)
    savedCursor = undefined

    if (input.textContent && input.textContent !== history[historyIndex]?.text) {
      ++historyIndex
      history.splice(historyIndex, history.length - historyIndex, {
        text: input.textContent,
        cursor: absoluteIndex
      })
    }

    let result: ReturnType<typeof parse<T, V>> | ParseError | ConstraintError

    try {
      result = parse(newTokens, constraints)
      input.removeAttribute('data-error-message')
      input.removeAttribute('data-error-start')
      input.removeAttribute('data-error-end')
    } catch (err) {
      if (err instanceof ParseError || err instanceof ConstraintError) {
        result = err
        input.setAttribute('data-error-message', err.rawMessage)
        input.setAttribute('data-error-start', err.startIndex!.toString())
        input.setAttribute('data-error-end', err.endIndex!.toString())

        const nodes = input.querySelectorAll('[data-node]')
        if (!nodes.length) return

        for (let n = 0; n < nodes.length; ++n) {
          const node = nodes.item(n)

          node.toggleAttribute('data-error', n >= err.startIndex! && n <= err.endIndex!)
        }
      } else {
        result = null
        if (err instanceof Error) input.setAttribute('data-error-message', err.message)
        input.removeAttribute('data-error-start')
        input.removeAttribute('data-error-end')
      }
    }
    onUpdate?.(result, newTokens, text)
  }

  const observer = new MutationObserver(update)

  function onKey (e: KeyboardEvent): void {
    if (e.key === 'Enter' || e.key === 'Escape') {
      e.stopPropagation()
      e.preventDefault()
      input.blur()
    } else if (e.key === 'z' && (e.metaKey || e.ctrlKey)) {
      e.stopPropagation()
      e.preventDefault()
      historyIndex = Math.min(history.length - 1, Math.max(0, historyIndex + (e.shiftKey ? 1 : -1)))
      const prior = history[historyIndex]
      if (prior !== undefined) {
        savedCursor = prior.cursor
        input.replaceChildren(prior.text)
      }
    }
  }

  input.setAttribute('role', 'textbox')
  input.setAttribute('contenteditable', 'plaintext-only')
  input.setAttribute('spellcheck', 'false')
  input.addEventListener('keydown', onKey)
  input.addEventListener('blur', update, { passive: true })

  observer.observe(input, { characterData: true, childList: true, subtree: true })
  if (parseOnInitialize) update()
  return () => {
    observer.disconnect()
    input.removeEventListener('keydown', onKey)
    input.removeEventListener('blur', update)
  }
}
