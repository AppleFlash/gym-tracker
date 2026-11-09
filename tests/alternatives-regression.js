// Evaluate in a disposable browser preview. Verify alternatives remain one program slot.
(async () => {
  const originalState=gym.state,originalId=gym.exerciseId,saved=localStorage.getItem(gym.KEY);
  const originalConfirm=window.confirm,originalAlert=window.alert,expanded=[...gym.expandedExercises];
  const settle=()=>new Promise(r=>setTimeout(r,30)),originalDsConfirm=ds.confirm;
  const failures=[],check=(ok,message)=>{if(!ok)failures.push(message);};
  const click=selector=>document.querySelector(selector).click();
  const input=(selector,value)=>{const el=document.querySelector(selector);el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));};
  const add=name=>{
    click('[data-action="addAlternative"][data-id="a1"]');
    click('[data-action="catalogGroup"][data-id="chest"]');
    click('[data-action="catalogNewExercise"]');
    const form=document.getElementById('catalogForm');
    form.elements.name.value=name;form.requestSubmit();
    const item=gym.state.groups.find(g=>g.id==='chest').items.at(-1);
    click(`[data-action="catalogPick"][data-id="${item.id}"]`);
    return gym.state.days.A[0].alternatives.at(-1).id;
  };
  const select=id=>click(`[data-action="selectWorkoutVariant"][data-variant="${id}"]`);
  const open=()=>click('[data-action="openWorkoutExercise"][data-id="a1"]');
  const record=(weight,reps)=>{
    click('[data-action="startWorkoutExercise"]');
    input('[data-set-field="weight"]',weight);input('[data-set-field="reps"]',reps);
    document.getElementById('workoutSetsForm').requestSubmit();
  };
  try{
    window.confirm=()=>true;ds.confirm=async()=>true;window.alert=()=>{};
    gym.state=gym.initial();gym.exerciseId=null;gym.expandedExercises.clear();gym.goWorkoutPage('A');
    click('[data-action="toggleAlternatives"][data-id="a1"]');
    check(document.querySelector('#alternatives-a1').hidden===false&&!gym.exerciseId,'Arrow must expand in place without opening the exercise');
    check(document.querySelector('[data-action="toggleAlternatives"][data-id="a1"]').getAttribute('aria-expanded')==='true','Arrow must expose its expanded state');
    const first=add('Жим в тренажёре'),second=add('Отжимания');
    for(let i=0;i<10;i++)add('Вариант '+i);
    check(gym.state.days.A.length===6&&gym.state.days.A[0].alternatives.length===12,'Repeated additions must not add program slots or impose a small limit');
    check(!gym.state.done.A.length&&!Object.keys(gym.state.sessions).length,'Adding alternatives must not start or complete training');
    check(document.querySelectorAll('#alternatives-a1 [role="radio"]').length===13,'Original exercise must remain selectable alongside all alternatives');
    select(first);open();
    check(gym.selectedExercise().id===first&&document.querySelector('h1').textContent==='Жим в тренажёре','Main row must open the chosen alternative');
    check(!document.querySelector('.chart'),'New alternative must not inherit the originals weight history');
    record('40','10');
    check(gym.state.done.A.includes('a1')&&gym.state.done.A.includes(first),'Saving alternative must complete both its own record and the original slot');
    check(document.querySelector('.percent').textContent==='17%','An alternative must count as one of six exercises');
    const originalWeightId=gym.state.days.A[0].weightId,altWeightId=gym.state.days.A[0].alternatives[0].weightId;
    check(originalWeightId!==altWeightId&&gym.last(gym.findExercise(altWeightId)).weight===40,'Alternative must have independent weight history');
    select(second);
    check(gym.state.done.A.includes('a1'),'Switching selection must not undo previously completed work');
    open();click('[data-action="startWorkoutExercise"]');input('[data-set-field="weight"]','0');input('[data-set-field="reps"]','15');
    click('[data-action="workoutBack"]');select('a1');open();
    record('22','8');
    check(gym.sessionFor('A',second).sets[0].reps==='15'&&!gym.sessionFor('A',second).completedAt,'Recording original must preserve another variants draft');
    check(document.querySelector('.percent').textContent==='17%','Completing original as well must not double-count progress');
    click('[data-action="done"][data-id="a1"]');
    check(!gym.state.done.A.includes(first)&&!gym.state.done.A.includes('a1'),'Unchecking slot must clear its alternative markers');
    select(first);click('[data-action="done"][data-id="a1"]');
    check(gym.state.done.A.includes(first)&&gym.state.done.A.includes('a1'),'Manual checkbox must apply to selected alternative and parent');
    const restored=gym.prepareHistory(JSON.parse(localStorage.getItem(gym.KEY)));
    check(restored.days.A[0].selectedId===first&&restored.days.A[0].alternatives.length===12,'Backup must preserve alternatives and selection');
    check(restored.sessions.A[first].sets[0].weight===40,'Backup must preserve separate variant sessions');
    click('[data-action="finish"]');await settle();
    const archived=gym.state.history[0].exercises[0];
    check(archived.performed.length===2&&archived.performed.some(e=>e.name==='Жим в тренажёре'),'Workout snapshot must retain actual exercises performed');
    check(document.querySelector('.session-history').textContent.includes('Жим в тренажёре'),'History must show alternative name and saved sets');
    check(!Object.keys(gym.state.sessions.A).length,'Finish must clear all variant sessions in this day');
    const snapshot=JSON.stringify(gym.state.history);
    gym.goWorkoutPage('A');select(first);open();click('[data-action="editDayExercise"]');
    check(!document.querySelector('#editForm [name="name"]'),'Program editor must not create or rename an exercise outside catalog');
    click('[data-action="close"]');
    gym.openCatalog();click('[data-action="catalogGroup"][data-id="chest"]');
    const catalogId=gym.state.days.A[0].alternatives.find(e=>e.id===first).weightId;
    click(`[data-action="catalogEditExercise"][data-id="${catalogId}"]`);
    document.querySelector('#catalogForm [name="name"]').value='Новое название';
    document.getElementById('catalogForm').requestSubmit();
    click('[data-action="close"]');
    check(JSON.stringify(gym.state.history)===snapshot,'Editing alternative must not rewrite archived snapshots');
    click('[data-action="editDayExercise"]');click('[data-action="removeModal"]');
    check(!gym.state.days.A[0].alternatives.some(e=>e.id===first)&&gym.activeVariant(gym.state.days.A[0]).id==='a1','Deleting selected alternative must return selection to original');
    check(gym.state.days.A.length===6,'Deleting alternative must keep original program slot');
    const bad=JSON.parse(JSON.stringify(gym.state));bad.days.A[0].alternatives=[{id:'a1',name:'Duplicate'}];
    let rejected=false;try{gym.prepareHistory(bad);}catch{rejected=true;}
    check(rejected,'Import must reject variant IDs that collide with original sessions');
    click('[data-action="toggleAlternatives"][data-id="a1"]');
    check(document.querySelector('#alternatives-a1').hidden,'Second arrow click must collapse the alternatives');
    return {passed:!failures.length,failures};
  }finally{
    gym.state=originalState;gym.exerciseId=originalId;window.confirm=originalConfirm;ds.confirm=originalDsConfirm;window.alert=originalAlert;
    gym.expandedExercises.clear();for(const key of expanded)gym.expandedExercises.add(key);gym.render();
    if(saved===null)localStorage.removeItem(gym.KEY);else localStorage.setItem(gym.KEY,saved);
  }
})()
