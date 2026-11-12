import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {HouseStoryState,CLUE_IDS} from '../sandbox/utsuro/dist/house-story.js';
const assets=new URL('../sandbox/utsuro/dist/assets/',import.meta.url);

test('newspaper is a seventh delayed clue and is required before the monk appears',()=>{
 const story=new HouseStoryState();assert.equal(CLUE_IDS.length,7);assert.equal(story.inspectClue('newspaper'),false);
 story.inspectClue('well');story.inspectClue('chains');story.noteFirstMove();story.examine();
 assert.equal(story.inspectClue('newspaper'),false,'warning must be closed first');story.dismiss();
 for(const id of CLUE_IDS.filter(id=>!['well','chains','newspaper'].includes(id)))story.inspectClue(id);
 assert.equal(story.phase,'clues');assert.equal(story.remainingClues,1);assert.equal(story.examineMonk(),false);
 assert.equal(story.inspectClue('newspaper'),true);assert.equal(story.phase,'monk-ready');assert.equal(story.remainingClues,0);
 assert.equal(story.inspectClue('newspaper'),false);assert.equal(story.remainingClues,0);story.reset();assert.equal(story.remainingClues,7);
});

test('newspaper can be the first delayed clue and each clue has a flower',()=>{
 const story=new HouseStoryState();story.noteFirstMove();story.examine();story.dismiss();story.inspectClue('newspaper');assert.equal(story.remainingClues,6);
 for(const id of CLUE_IDS.filter(id=>id!=='newspaper'))story.inspectClue(id);assert.equal(story.phase,'monk-ready');
 const flowers=JSON.parse(readFileSync(new URL('higanbana-layout.json',assets),'utf8'));assert.equal(flowers.placements.length,CLUE_IDS.length);
 const article=JSON.parse(readFileSync(new URL('newspaper/article.json',assets),'utf8'));const text=article.paragraphs.join('');
 assert.match(text,/██県██郡██町/);assert.match(text,/犯人の特定には至っておらず/);assert.equal(article.paragraphs.length,4);
});
