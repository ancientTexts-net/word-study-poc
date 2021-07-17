import xRegExp from 'xregexp';
import {tokenize} from 'string-punctuation-tokenizer';
import XRegExp from 'xregexp';

// bridge: aligned USFM bible
// target: (un-)aligned USFM bible.
export const getAlignmentFromProskomma = async ({sourceDocument, targetDocument}) => {
  // Reusable: Word tokens with alignment (where available).
  // Transforms Proskomma into uW helpful object.
  // (Transforms GraphQL --> into helpful object.)
  const sourceTokens = await getTokensFromProskomma({bibleDocument: sourceDocument});
  const targetTokens = await getTokensFromProskomma({bibleDocument: targetDocument});

  // Transform uW helpful object --> for alignment-editor-rcl.
  const sourceSegments = getSegmentsFromTokens({tokens: sourceTokens});
  const targetSegments = getSegmentsFromTokens({tokens: targetTokens});
  const links = getLinksFromTokens({sourceTokens, targetTokens});

  return {
    sourceSegments,
    targetSegments,
    links,
  };
};

const getLinksFromTokens = ({sourceTokens, targetTokens})=> {
  const occurrenceCounter = [];

  const links = sourceTokens?.map((sourceToken,iiSourceToken)=> {
    if (!occurrenceCounter[sourceToken.payload]) {
      occurrenceCounter[sourceToken.payload] = 1;
    } else {
      occurrenceCounter[sourceToken.payload]++;
    }

    const currentOccurrence = occurrenceCounter[sourceToken.payload];

    const linkCandidates = targetTokens?.map((targetToken, index)=> {
      if (
        targetToken.alignedToken === sourceToken.payload
        && targetToken.occurrence === currentOccurrence
      ){
        return index;
      } else {
        return null;
      }
    }).filter(link => link != null);

    if (linkCandidates && linkCandidates.length > 0)
    {
      return {
        //sourceToken: sourceToken?.payload,
        sources: [iiSourceToken],
        targets: linkCandidates,
        type: 'manual',
      };
    } else {
      return null;
    }
  });

  console.log(links);
  return links;
};

const getSegmentsFromTokens = ({tokens})=>{
  return tokens?.map(token => {
    return {
      text: token.payload,
      // TODO: can we provide POS here ?
      //pos: token.pos
    }
  });
};


// TODO: reuse string-puncutation-tokenizer: _wordOrNumber:
const _word = '[\\pL\\pM\\u200D\\u2060]+';
const _number = '[\\pN\\pNd\\pNl\\pNo]+';
const _wordOrNumber = '(' + _word + '|' + _number + ')';

// POS for source/original text:
const SCOPE_FILTER_CHAPTER = xRegExp('chapter/(\\d+)');
const SCOPE_FILTER_VERSE = xRegExp('verse/(\\d+)');
const SCOPE_FILTER_SPANWITHATTS_XMORPH_1 = xRegExp('attribute/spanWithAtts/w/x-morph/1/(' + _wordOrNumber + '+)');
const SCOPE_FILTER_SPANWITHATTS_XSTRONG_0 = xRegExp('attribute/spanWithAtts/w/strong/0/([\\w\\d]+)');
const SCOPE_FILTER_SPANWITHATTS_LEMMA_0 = XRegExp('attribute/spanWithAtts/w/lemma/0/(' + _wordOrNumber + '+)');

// ZALN
// POS for GL text:
const SCOPE_FILTER_ZALN_XMORPH_1 = /attribute\/milestone\/zaln\/x-morph\/1\/(\w+)/i;
//const SCOPE_FILTER_ZALN_XCONTENT = /attribute\/milestone\/zaln\/x-content\/0\/(\w+)/i;
const SCOPE_FILTER_ZALN_XCONTENT = xRegExp('attribute/milestone/zaln/x-content/0/(' + _wordOrNumber + '+)');
const SCOPE_FILTER_ZALN_OCCURRENCE = /attribute\/milestone\/zaln\/x-occurrence\/0\/(\d)/i;
const SCOPE_FILTER_ZALN_OCCURRENCES = /attribute\/milestone\/zaln\/x-occurrences\/0\/(\d)/i;

export const getTokensFromProskomma = async ({bibleDocument}) => {
  const SCOPE_SPANWITHATTS_W = "spanWithAtts/w";

  let alignments = bibleDocument && bibleDocument.cv[0].tokens.map((token) => {
    let isWord = (token.scopes.find(scope => scope === SCOPE_SPANWITHATTS_W) != null);
    let tokenized = null;
    if (isWord) {
      // Exclude puncuation, etc.
      tokenized = tokenize({text: token.payload});
      isWord = (tokenized && tokenized.length > 0);
    }

    if (isWord) {
      // Transform Proskomma into uW.
      // TODO: detect "spanWithAttributes" scopes or "zaln" scopes.
      return {
        payload: tokenized[0],
        //alignedToken: getAlignedToken({token}),
        
        chapter: getAttributeFromScopes({scopes: token.scopes, scopeFilter: SCOPE_FILTER_CHAPTER}),
        verse: getAttributeFromScopes({scopes: token.scopes, scopeFilter: SCOPE_FILTER_VERSE}),
        
        alignedToken: getAttributeFromScopes({scopes: token.scopes, scopeFilter: SCOPE_FILTER_ZALN_XCONTENT}),
        occurrence: parseInt(getAttributeFromScopes({scopes: token.scopes, scopeFilter: SCOPE_FILTER_ZALN_OCCURRENCE})) || null,
        occurrences: parseInt(getAttributeFromScopes({scopes: token.scopes, scopeFilter: SCOPE_FILTER_ZALN_OCCURRENCES})) || null,
        lemma: getAttributeFromScopes({scopes: token.scopes, scopeFilter: SCOPE_FILTER_SPANWITHATTS_LEMMA_0}),
        strong: getAttributeFromScopes({scopes: token.scopes, scopeFilter: SCOPE_FILTER_SPANWITHATTS_XSTRONG_0}),
        pos: getAttributeFromScopes({scopes: token.scopes, scopeFilter: SCOPE_FILTER_SPANWITHATTS_XMORPH_1})
              || getAttributeFromScopes({scopes: token.scopes, scopeFilter: SCOPE_FILTER_ZALN_XMORPH_1})
      }
    }
    else {
      return null;
    }
  });

  alignments = alignments?.filter(token => token != null);

  return alignments;
};

export const getTokensFromProskommaMainSequenceDocSet = async ({docSet}) => {
  const docSetTokensPromises = docSet?.map(
    document => getTokensFromProskommaMainSequenceDocument({document})
  );

  const combinedTokens = [].concat.apply([], await Promise.all(docSetTokensPromises));

  return combinedTokens;
}

export const getTokensFromProskommaMainSequenceDocument = async ({document}) => {
  const SCOPE_SPANWITHATTS_W = "spanWithAtts/w";

  const bookCode = document?.bookCode;

  const blockTokens = document && document.mainSequence?.blocks?.map(
    block => block.tokens
  );
  const tokens = [].concat.apply([], blockTokens);

  let alignments = tokens?.map((token) => {
    let isWord = (token.scopes.find(scope => scope === SCOPE_SPANWITHATTS_W) != null);
    let tokenized = null;
    if (isWord) {
      // Exclude puncuation, etc.
      tokenized = tokenize({text: token.payload});
      isWord = (tokenized && tokenized.length > 0);
    }

    if (isWord) {
      // Transform Proskomma into uW.
      // TODO: detect "spanWithAttributes" scopes or "zaln" scopes.
      return {
        payload: tokenized[0],
        //alignedToken: getAlignedToken({token}),
        
        bookCode: bookCode,

        chapter: getAttributeFromScopes({scopes: token.scopes, scopeFilter: SCOPE_FILTER_CHAPTER}),
        verse: getAttributeFromScopes({scopes: token.scopes, scopeFilter: SCOPE_FILTER_VERSE}),
        
        alignedToken: getAttributeFromScopes({scopes: token.scopes, scopeFilter: SCOPE_FILTER_ZALN_XCONTENT}),
        occurrence: parseInt(getAttributeFromScopes({scopes: token.scopes, scopeFilter: SCOPE_FILTER_ZALN_OCCURRENCE})) || null,
        occurrences: parseInt(getAttributeFromScopes({scopes: token.scopes, scopeFilter: SCOPE_FILTER_ZALN_OCCURRENCES})) || null,
        lemma: getAttributeFromScopes({scopes: token.scopes, scopeFilter: SCOPE_FILTER_SPANWITHATTS_LEMMA_0}),
        strong: getAttributeFromScopes({scopes: token.scopes, scopeFilter: SCOPE_FILTER_SPANWITHATTS_XSTRONG_0}),
        pos: getAttributeFromScopes({scopes: token.scopes, scopeFilter: SCOPE_FILTER_SPANWITHATTS_XMORPH_1})
              || getAttributeFromScopes({scopes: token.scopes, scopeFilter: SCOPE_FILTER_ZALN_XMORPH_1})
      }
    }
    else {
      return null;
    }
  });

  alignments = alignments?.filter(token => token != null);

  return alignments;
};

const getAttributeFromScopes = ({scopes, scopeFilter})=> {
  let matchedScope;
  if (scopeFilter && scopeFilter.exec)
  {
    matchedScope = scopes.find(scope => scopeFilter.exec(scope));
  }
  else {
    matchedScope = scopes.find(scope => scope.match(scopeFilter));
  }

  
  let attribute = null;
  if (matchedScope) {
    const matches = matchedScope.match(scopeFilter);
    attribute = (matches?.length > 1)? matches[1] : matches[0];
  }
  return attribute;
};
