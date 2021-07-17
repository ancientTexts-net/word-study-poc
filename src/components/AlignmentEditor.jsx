import React, { useMemo, useState, useEffect } from 'react';
import {AlignmentEditor} from 'alignment-editor-rcl';

import useProskomma from '../hooks/useProskomma';
import useQuery from '../hooks/useQuery';
import useAlignmentAdapter from '../core/alignmentAdapters/useAlignmentAdapter';
import {getTokensFromProskommaMainSequenceDocSet} from '../core/alignmentAdapters/alignmentHelpers';

import {getBooks} from '../core/books';
import { senses } from '../core/lexicon/helpers';

export default function Component () {
  const resources = [
    { owner: 'unfoldingWord', lang: 'el-x-koine', abbr: 'ugnt' },
    { owner: 'unfoldingWord', lang: 'en', abbr: 'ult', tag: '25' },
    { owner: 'translate_test', lang: 'es-419', abbr: 'gst' },
  ];
  
  const query = `{
    source: docSet(id:"unfoldingWord/el-x-koine_ugnt") {
      documents 
      {  
        bookCode: header(id: "bookCode")
        mainSequence { 
          id type blocks {  
            tokens { payload scopes position }
          } 
        }
      } 
    }
    target: docSet(id:"unfoldingWord/en_ult") {
      documents 
      {  
        bookCode: header(id: "bookCode")
        mainSequence { 
          id type blocks {  
            tokens { payload scopes position }
          } 
        }
      } 
    }
  }`;

  // const query = `
  // { docSets
  //   { 
  //     id
  //   } 
  // }
  // `;

  //const books = getBooks({category: 'bible-nt'});
  //const books = ['tit'];
  const books = ['1jn', '2jn', '3jn'];
  
  const {state: { proskomma, changeIndex }} = useProskomma({ resources, books });
  //const {state} = useAlignmentAdapter({proskomma, reference, changeIndex});
  
  const {state: queryState} = useQuery({proskomma, changeIndex, query});

  const [tokens, setTokens] = useState([]);
  const [strongs, setStrongs] = useState([]);
  const [searchResult, setSearchResult] = useState([]);
  const [searchOccurrences, setSearchOccurrences] = useState([]);
  
  const onState = (a) => {
    console.log('STATE UPDATED', a);
  };

  useEffect(async () => {
    console.log("pk // useEffect // ", queryState?.data);

    const _tokensPromises = (queryState?.data?.source?.documents && queryState?.data?.target?.documents
                  && {
                    sourceTokens: await getTokensFromProskommaMainSequenceDocSet({docSet: queryState?.data?.source.documents}),
                    targetTokens: await getTokensFromProskommaMainSequenceDocSet({docSet: queryState?.data?.target.documents}),
                  });

    const _tokens = await _tokensPromises;

    setTokens(_tokens);
    // TODO: does changeIndex get set after the SECOND resource(s) are loaded?
    
    console.log("pk // useEffect // _tokens ", _tokens);
  }, [queryState]);

  useEffect(async () => {
    const _uniqueStrongs = [...new Set(tokens?.sourceTokens?.map((token) => {
      return token.strong;
    }))].sort();

    const _strongsPromises = _uniqueStrongs?.map(async (strong) => {
      const currentToken = tokens?.sourceTokens?.find(
        token => token.strong === strong
      );
      return {
        strong: currentToken.strong,
        lemma: currentToken.lemma, 
        senses: await senses({strong: currentToken.strong})
      }
    });

    const _strongs = await Promise.all(_strongsPromises);
    
    setStrongs(_strongs);
    
    console.log("pk // useEffect // strongs ", _strongs);
  }, [tokens]);

  useEffect(() => {
    const searchToken = "and".toLowerCase();

    const searchSenses = strongs?.filter(
      strong => strong?.senses?.filter(
        sense => sense?.gloss?.toLowerCase() === searchToken
      ).length > 0
    );
    
    setSearchResult(searchSenses);
    
    console.log("pk // useEffect // search ", searchSenses);
  }, [strongs]);

  useEffect(() => {
    const _searchOccurrences = searchResult?.map(
      _result => tokens?.sourceTokens?.filter(
        token => token?.strong == _result.strong
      )
    );

    const _sortedSearchOccurrences = _searchOccurrences.sort(
      (occurrenceA, occurrenceB) => occurrenceB.length - occurrenceA.length
    ).map(
        searchOccurrenceResults => searchOccurrenceResults.sort(
          (a,b) => a.bookCode.localeCompare(b.bookCode)
                    || a.chapter.localeCompare(b.chapter)
                    || a.verse.localeCompare(b.verse)
        )
      );
    
    setSearchOccurrences(_sortedSearchOccurrences);
    
    console.log("pk // useEffect // _searchOccurrences ", _searchOccurrences);
    console.log("pk // useEffect // _sortedSearchOccurrences ", _sortedSearchOccurrences);
  }, [searchResult]);

  return useMemo(() => {
    //let status = (JSON.stringify(queryState?.data?.source, null, 2) || '').substring(0,100);
    //let status = (JSON.stringify(queryState?.data?.ult, null, 2) || '').substring(0,100);
    //if (status) { status = status.substring(0, 100); }
    
    console.log("pk // useEffect // search ", searchResult);

    return (
      <div>
      <hr/>
      {JSON.stringify(queryState && queryState.errors)}
      
      <div style={{display: 'none'}}>
        {query}
        <hr/>
        <pre>{(JSON.stringify(tokens, null, 2)||'').substring(0,500)}</pre>
        <hr/>
        <pre>{(JSON.stringify(strongs, null, 2)||'').substring(0,1000)}</pre>
      </div>

      <hr/>
      <pre>{(JSON.stringify(searchResult, null, 2)||'')}</pre>
      <hr/>
      <pre>{(JSON.stringify(searchOccurrences, null, 2)||'')}</pre>
      </div>
    );
  }, [tokens, strongs, searchResult, searchOccurrences]);
};
