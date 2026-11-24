import { addIcon } from './offline-icon-registry';

// Vben's header toggle uses the Element Plus fold/expand glyphs. Register the
// two original icons locally so the offline renderer never replaces them with
// the application fallback or performs a runtime network request.
addIcon('ep:fold', {
  body: '<path fill="currentColor" d="M896 192H128v128h768zm0 256H384v128h512zm0 256H128v128h768zM320 384L128 512l192 128z"/>',
  height: 1024,
  width: 1024,
});

addIcon('ep:expand', {
  body: '<path fill="currentColor" d="M128 192h768v128H128zm0 256h512v128H128zm0 256h768v128H128zm576-352l192 160l-192 128z"/>',
  height: 1024,
  width: 1024,
});
