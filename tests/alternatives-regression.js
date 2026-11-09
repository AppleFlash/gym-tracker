// Evaluate in a disposable browser preview. Verify alternatives remain one program slot.
(() => {
  const originalState=state,originalId=exerciseId,saved=localStorage.getItem(KEY);
  const originalConfirm=window.confirm,originalAlert=window.alert,expanded=[...expandedExercises];
  const failures=[],check=(ok,message)=>{if(!ok)failures.push(message);};
  const click=selector=>document.querySelector(selector).click();
  const input=(selector,value)=>{const el=document.querySelector(selector);el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));};
  const add=name=>{
    click('[data-action="addAlternative"][data-id="a1"]');
    const form=document.getElementById('editForm');
    form.elements.name.value=name;form.requestSubmit();
    return state.days.A[0].alternatives.at(-1).id;
  };
  const select=id=>click(`[data-action="selectWorkoutVariant"][data-variant="${id}"]`);
  const open=()=>click('[data-action="openWorkoutExercise"][data-id="a1"]');
  const record=(weight,reps)=>{
    click('[data-action="startWorkoutExercise"]');
    input('[data-set-field="weight"]',weight);input('[data-set-field="reps"]',reps);
    document.getElementById('workoutSetsForm').requestSubmit();
  };
  try{
    window.confirm=()=>true;window.alert=()=>{};
    state=initial();exerciseId=null;expandedExercises.clear();goWorkoutPage('A');
    click('[data-action="toggleAlternatives"][data-id="a1"]');
    check(document.querySelector('#alternatives-a1').hidden===false&&!exerciseId,'Arrow must expand in place without opening the exercise');
    check(document.querySelector('[data-action="toggleAlternatives"][data-id="a1"]').getAttribute('aria-expanded')==='true','Arrow must expose its expanded state');
    const first=add('Жим в тренажёре'),second=add('Отжимания');
    for(let i=0;i<10;i++)add('Вариант '+i);
    check(state.days.A.length===6&&state.days.A[0].alternatives.length===12,'Repeated additions must not add program slots or impose a small limit');
    check(!state.done.A.length&&!Object.keys(state.sessions).length,'Adding alternatives must not start or complete training');
    check(document.querySelectorAll('#alternatives-a1 [role="radio"]').length===13,'Original exercise must remain selectable alongside all alternatives');
    select(first);open();
    check(selectedExercise().id===first&&document.querySelector('h1').textContent==='Жим в тренажёре','Main row must open the chosen alternative');
    check(!document.querySelector('.chart'),'New alternative must not inherit the originals weight history');
    record('40','10');
    check(state.done.A.includes('a1')&&state.done.A.includes(first),'Saving alternative must complete both its own record and the original slot');
    check(document.querySelector('.percent').textContent==='17%','An alternative must count as one of six exercises');
    const originalWeightId=state.days.A[0].weightId,altWeightId=state.days.A[0].alternatives[0].weightId;
    check(originalWeightId!==altWeightId&&last(findExercise(altWeightId)).weight===40,'Alternative must have independent weight history');
    select(second);
    check(state.done.A.includes('a1'),'Switching selection must not undo previously completed work');
    open();click('[data-action="startWorkoutExercise"]');input('[data-set-field="weight"]','0');input('[data-set-field="reps"]','15');
    click('[data-action="workoutBack"]');select('a1');open();
    record('22','8');
    check(sessionFor('A',second).sets[0].reps==='15'&&!sessionFor('A',second).completedAt,'Recording original must preserve another variants draft');
    check(document.querySelector('.percent').textContent==='17%','Completing original as well must not double-count progress');
    click('[data-action="done"][data-id="a1"]');
    check(!state.done.A.includes(first)&&!state.done.A.includes('a1'),'Unchecking slot must clear its alternative markers');
    select(first);click('[data-action="done"][data-id="a1"]');
    check(state.done.A.includes(first)&&state.done.A.includes('a1'),'Manual checkbox must apply to selected alternative and parent');
    const restored=prepareHistory(JSON.parse(localStorage.getItem(KEY)));
    check(restored.days.A[0].selectedId===first&&restored.days.A[0].alternatives.length===12,'Backup must preserve alternatives and selection');
    check(restored.sessions.A[first].sets[0].weight===40,'Backup must preserve separate variant sessions');
    click('[data-action="finish"]');
    const archived=state.history[0].exercises[0];
    check(archived.performed.length===2&&archived.performed.some(e=>e.name==='Жим в тренажёре'),'Workout snapshot must retain actual exercises performed');
    check(document.querySelector('.session-history').textContent.includes('Жим в тренажёре'),'History must show alternative name and saved sets');
    check(!Object.keys(state.sessions.A).length,'Finish must clear all variant sessions in this day');
    const snapshot=JSON.stringify(state.history);
    goWorkoutPage('A');select(first);open();click('[data-action="editDayExercise"]');
    document.querySelector('#editForm [name="name"]').value='Новое название';
    document.getElementById('editForm').requestSubmit();
    check(JSON.stringify(state.history)===snapshot,'Editing alternative must not rewrite archived snapshots');
    click('[data-action="editDayExercise"]');click('[data-action="removeModal"]');
    check(!state.days.A[0].alternatives.some(e=>e.id===first)&&activeVariant(state.days.A[0]).id==='a1','Deleting selected alternative must return selection to original');
    check(state.days.A.length===6,'Deleting alternative must keep original program slot');
    const bad=JSON.parse(JSON.stringify(state));bad.days.A[0].alternatives=[{id:'a1',name:'Duplicate'}];
    let rejected=false;try{prepareHistory(bad);}catch{rejected=true;}
    check(rejected,'Import must reject variant IDs that collide with original sessions');
    click('[data-action="toggleAlternatives"][data-id="a1"]');
    check(document.querySelector('#alternatives-a1').hidden,'Second arrow click must collapse the alternatives');
    return {passed:!failures.length,failures};
  }finally{
    state=originalState;exerciseId=originalId;window.confirm=originalConfirm;window.alert=originalAlert;
    expandedExercises.clear();for(const key of expanded)expandedExercises.add(key);render();
    if(saved===null)localStorage.removeItem(KEY);else localStorage.setItem(KEY,saved);
  }
})()
