import test from 'node:test';
import assert from 'node:assert/strict';
import {HouseStoryState,CLUE_IDS,CLUE_HINTS} from '../sandbox/utsuro/dist/house-story.js';

test('doll hints unlock after the warning, cycle unseen clues, and never advance the ritual',()=>{
 const story=new HouseStoryState();
 assert.equal(story.nextClueHint(),null);
 story.inspectClue('well');story.noteFirstMove();story.examine();
 assert.equal(story.nextClueHint(),null);story.dismiss();
 const unseen=CLUE_IDS.filter(id=>id!=='well');
 assert.deepEqual(unseen.map(()=>story.nextClueHint()),unseen.map(id=>CLUE_HINTS[id]));
 assert.equal(story.nextClueHint(),CLUE_HINTS.chains);
 story.inspectClue('shoes');
 assert.equal(story.nextClueHint(),CLUE_HINTS.tablets);
 assert.equal(story.remainingClues,5);assert.equal(story.phase,'clues');
 for(const id of CLUE_IDS)story.inspectClue(id);
 assert.equal(story.nextClueHint(),'……もう、見つけたね。あの声がする部屋へ……');
 story.examineMonk();assert.equal(story.nextClueHint(),null);
 story.reset();assert.equal(story.lastHint,null);assert.equal(story.nextClueHint(),null);
 story.noteFirstMove();story.examine();story.dismiss();
 assert.equal(story.nextClueHint(),CLUE_HINTS.well);
});

test('one remaining clue can be requested repeatedly without consuming it',()=>{
 const story=new HouseStoryState();story.noteFirstMove();story.examine();story.dismiss();
 for(const id of CLUE_IDS.filter(id=>id!=='note'))story.inspectClue(id);
 for(let i=0;i<10;i++)assert.equal(story.nextClueHint(),CLUE_HINTS.note);
 assert.equal(story.remainingClues,1);assert.equal(story.phase,'clues');
});
