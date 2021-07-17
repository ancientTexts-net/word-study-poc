import { useState } from 'react';
import { useDeepCompareEffect } from 'use-deep-compare';
import useQuery from '../../hooks/useQuery';
import {getAlignmentFromProskomma, getTokensFromProskomma} from './alignmentHelpers';
import { getGlossesFromLexicon, getGlossesFromReferenceTokens } from './lexiconHelpers';
import partOfSpeechHelper from './partOfSpeechHelper';

export default function useAlignmentAdapter({proskomma, reference, changeIndex}) {
  const alignmentQueryTemplate = `{
    original: docSet(id:"unfoldingWord/el-x-koine_ugnt") {
      document(bookCode:"%bookCode%") {
        cv(
          includeContext: true
          ) {
          tokens {payload scopes}
        }
      }
    }
    bridge: docSet(id:"unfoldingWord/en_ult") {
      document(bookCode:"%bookCode%") {
        cv(
          includeContext: true
          ) {
          tokens {payload scopes}
        }
      }
    }
    target: docSet(id:"translate_test/es-419_gst") {
      document(bookCode:"%bookCode%") {
        cv(
          includeContext: true
          ) {
          tokens {payload scopes}
        }
      }
    }
  }`;
  
  const query = alignmentQueryTemplate
    .replace(/%bookCode%/g, reference.bookId || '')
    .replace(/%chapter%/g, reference.chapter)
    .replace(/%verse%/g, reference.verse);

  // : {query: lastQuery, data, errors, changeIndex: lastChange}
  const defaultState = {
    sourceGlosses: null,
    sourceSegments: [],

    referenceSegments: [],
    referenceLinks: [],

    targetSegments: [],
    userLinks: [],
  };
  const [state, setState] = useState(defaultState);
  const {state: queryState} = useQuery({proskomma, changeIndex, query});
  
  useDeepCompareEffect(async () => {
    if (queryState && queryState.data
        && queryState.data.original?.document
        && queryState.data.bridge?.document
        && queryState.data.target?.document)
    {
      // Align original --> primary GL
      const bridgeAlignments = await getAlignmentFromProskomma({
        sourceDocument: queryState.data?.original?.document,
        targetDocument: queryState.data?.bridge?.document
      });
      
      // Align secondary GL --> primary GL
      const targetAlignments = await getAlignmentFromProskomma({
        sourceDocument: queryState.data?.original?.document,
        targetDocument: queryState.data?.target?.document
      });

      const sourceTokens = await getTokensFromProskomma({bibleDocument: queryState.data.original?.document});
      const referenceTokens = await getTokensFromProskomma({bibleDocument: queryState.data.bridge?.document});
      //const sourceGlosses = getGlossesFromLexicon({tokens:sourceTokens});
      const sourceGlosses = await getGlossesFromReferenceTokens({sourceTokens, referenceTokens});

      const _sourceSegments     = bridgeAlignments.sourceSegments;
      const _referenceSegments  = bridgeAlignments.targetSegments;
      const _referenceLinks     = bridgeAlignments.links;
      const _sourceGlosses      = sourceGlosses;
      const _targetSegments     = targetAlignments.targetSegments;

      setState({
        sourceGlosses: _sourceGlosses,
        sourceSegments: partOfSpeechHelper(_sourceSegments),

        referenceSegments: _referenceSegments,
        referenceLinks: _referenceLinks,

        targetSegments: _targetSegments,
        userLinks: null,
      });
    }
  }, [proskomma, reference, changeIndex, queryState]);
  
  console.log("useAlignmentAdapter // state", {...state, queryState});

  return {
    state: {...state},
    actions: {},
  };
};
