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

  const chapterVerseTemplate = `{
    target: docSet(id:"unfoldingWord/en_ult") {
      document(bookCode:"%bookCode%") {
        cv(chapter:"%chapter%" verses:["%verse%"]) {
          text
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
  
  const {state: { proskomma, changeIndex }, actions} = useProskomma({ resources, books });
  //const {state} = useAlignmentAdapter({proskomma, reference, changeIndex});
  
  const {state: queryState} = useQuery({proskomma, changeIndex, query});

  const [tokens, setTokens] = useState([]);
  const [strongs, setStrongs] = useState([]);
  const [searchResult, setSearchResult] = useState([]);
  const [searchOccurrences, setSearchOccurrences] = useState([]);
  const [searchStats, setSearchStats] = useState([]);
  
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
                    || a.chapter - b.chapter
                    || a.verse - b.verse
        )
      );
    
    setSearchOccurrences(_sortedSearchOccurrences);
    
    console.log("pk // useEffect // _searchOccurrences ", _searchOccurrences);
    console.log("pk // useEffect // _sortedSearchOccurrences ", _sortedSearchOccurrences);
  }, [searchResult]);

  useEffect(async() => {
    const _searchStats = searchOccurrences?.map(
      occurrence => ({
        lemma: occurrence[0]?.lemma,
        strong: occurrence[0]?.strong,
        nOccurrences: occurrence?.length,
        nDistinctVerses: null,
        occurrences: occurrence.map(
          x => ({lemma: x.lemma, bookCode: x.bookCode, chapter: x.chapter, verse: x.verse})
        ),
      })
    );

    // Get distinct verses:
    const seen = {};
    _searchStats.forEach(
      occurrence => {
        seen[occurrence.lemma] = [];
        occurrence.distinctVerses = occurrence.occurrences.filter(
          tempOccurrence => {
            const hash = tempOccurrence.bookCode + "." + tempOccurrence.chapter + "." + tempOccurrence.verse;
            if (!seen[occurrence.lemma][hash]) {
              seen[occurrence.lemma][hash] = true;
              return true;
            }
          }
        )
      }
    );
    
    _searchStats.forEach(
      occurrence => occurrence.nDistinctVerses = occurrence.distinctVerses?.length
    );
    
    const searchStatsWithTextsPromises = _searchStats.map(
      async(occurrence) => ({...occurrence, distinctVerses: await Promise.all(
        occurrence.distinctVerses.map(
        async(verse) => {
          const query = chapterVerseTemplate
            .replace(/%bookCode%/g, verse.bookCode || '')
            .replace(/%chapter%/g, verse.chapter)
            .replace(/%verse%/g, verse.verse);
          //console.log("pk // texts // query ", query);
          return (
            {
              bookCode: verse.bookCode,
              chapter: verse.chapter,
              verse: verse.verse,
              lemma: verse.lemma,
              //textQuery: await actions.runQuery(query),
              text: (await actions.runQuery(query))?.data?.target?.document?.cv[0]?.text?.replaceAll("\n", " ")
          });
        }
      )
    )}));

    const searchStatsWithTexts = await Promise.all(searchStatsWithTextsPromises);
    console.log("pk // texts // searchStatsWithTexts ", searchStatsWithTexts);

    setSearchStats(searchStatsWithTexts);
  }, [searchOccurrences]);

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
        <pre>{(JSON.stringify(strongs, null, 2)||'').substring(0,500)}</pre>
        <hr/>
        <pre>{(JSON.stringify(searchResult, null, 2)||'')}</pre>
        <hr/>
        <pre>{(JSON.stringify(searchOccurrences, null, 2)||'')}</pre>
      </div>

      <hr/>
      <pre>{(JSON.stringify(searchStats, null, 2)||'')}</pre>
      </div>
    );
  }, [tokens, strongs, searchResult, searchOccurrences, searchStats]);
};
