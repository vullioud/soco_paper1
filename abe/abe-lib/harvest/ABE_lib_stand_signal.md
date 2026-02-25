# DeepWiki Q&A with Code Context for Repository: edfm-tum/iland-model
## Q1
I am trying to set up a signal based STP that work when my soco agent sent a specific signal. I am trying to make the selective thinning work with this logic. 
I have these functions: what do you think 
// 4. Plenter Thinning
MEGA_STP_ACTIVITIES['plenter'] = {
    id: 'MegaSTP_Plenter',
    type: 'scheduled',
    schedule: { signal: 'do_plenter' },
    finalHarvest: false,

    onEvaluate: function() {
        return true; 
    },

onExecute: function() {
        console.log(`[MEGA-STP] Executing 'plenter' for stand ${stand.id}.`);

        var plenterCurve = stand.flag('abe_param_plenterCurve') || {};
        const dbhSteps = 5;
        var total_harvested_count = 0;

        console.log("[MEGA-STP] -> Received plenterCurve: " + JSON.stringify(plenterCurve));
        
        
        console.log("[MEGA-STP] -> Stand Inventory Before Harvest:");
        stand.trees.loadAll(); // Load all trees FROM THE CURRENT STAND.
        
        // Diagnostic Logging (now correctly scoped)
        var species_ids = [];
        for (var i = 0; i < stand.trees.count; i++) {
            var species_id = stand.trees.tree(i).species;
            if (species_ids.indexOf(species_id) === -1) {
                species_ids.push(species_id);
            }
        }
        for (var i = 0; i < species_ids.length; i++) {
            var species_id = species_ids[i];
            var filter_string = 'species=' + species_id;
            // Use sum() on the already loaded list for efficiency
            var species_count = stand.trees.sum('1', filter_string);
            if (species_count > 0) {
                console.log(`  - Species: ${species_id}, Count: ${species_count}`);
            }
        }

        var dbhClasses = Object.keys(plenterCurve).sort(function(a, b) { return parseInt(b) - parseInt(a); }); // Sort descending

        for (var i = 0; i < dbhClasses.length; i++) {
            var dbh = parseInt(dbhClasses[i], 10);
            var targetCount = plenterCurve[dbh] * stand.area;
            
            var filter = 'dbh > ' + (dbh - dbhSteps) + ' and dbh <= ' + dbh;
            
            // Load only the trees for the current class into the list.
            var treesInClass = stand.trees.load(filter);

            if (treesInClass > targetCount) {
                var treesToHarvest = treesInClass - targetCount;
                
                var treesToKeepInListForHarvest = treesInClass - (treesInClass - treesToHarvest);
                stand.trees.filterRandomExclude(treesToKeepInListForHarvest);
                
                var harvested_this_class = stand.trees.harvest();
                total_harvested_count += harvested_this_class;
                console.log(`  - DBH Class ${dbh}: In stand=${treesInClass}, Target=${targetCount.toFixed(0)}. Surplus=${treesToHarvest}. Marking ${harvested_this_class} trees for harvest.`);
            }
        }
        
        stand.trees.removeMarkedTrees();
        console.log(`[MEGA-STP] -> Total harvested trees: ${total_harvested_count}.`);
    },
    onExecuted: function() {
        console.log(`[MEGA-STP] onExecuted for plenter on stand ${stand.id}.`);
        stand.setFlag('abe_last_activity', 'MegaSTP_Plenter');
        stand.setFlag('abe_last_activity_year', Globals.year);
        stand.setFlag('abe_need_reassessment', false);
    }
};

MEGA_STP_ACTIVITIES['selectiveThinning_select'] = {
    id: 'MegaSTP_SelectiveThinning_Select',
    type: 'thinning',
    thinning: 'selection',
    schedule: { signal: 'do_selectiveThinning_select' },

    // Parameters are read dynamically from flags at the moment of execution.
    N: function() { return stand.flag('abe_param_nTrees'); },
    NCompetitors: function() { return stand.flag('abe_param_nCompetitors'); },
    speciesSelectivity: function() { return stand.flag('abe_param_speciesSelectivity') || {}; },
    ranking: 'height',

    // onExecuted is the correct event handler for signal-triggered activities.
    onExecuted: function() {
        console.log(`[MEGA-STP] SELECT phase complete for stand ${stand.id}. Crop trees and competitors are now marked.`);
        
        // This event runs AFTER the C++ selection algorithm has marked the trees.
        // Now, we perform the FIRST removal.
        
        // 1. Count all newly marked competitors and store this total for future steps.
        var total_competitors = stand.trees.load('markcompetitor=true');
        stand.setFlag('abe_param_totalCompetitors', total_competitors);
        
        // 2. Read the fraction to remove, prepared by the agent.
        var fraction_to_remove = stand.flag('abe_param_fraction_to_remove') || 0;
        var trees_to_remove_this_step = Math.ceil(total_competitors * fraction_to_remove);

        // 3. The list currently contains all competitors. Filter it down to the subset to remove.
        stand.trees.filterRandom(trees_to_remove_this_step);
        var harvested_count = stand.trees.harvest();
        stand.trees.removeMarkedTrees();

        console.log(`[MEGA-STP] -> Initial removal: Harvested ${harvested_count} of ${total_competitors} total competitors.`);
        
        // 4. Set the persistent flag to indicate the selection phase is done.
        stand.setFlag('abe_selective_thinning_initialized', true);

        // 5. Set completion flags for the agent to observe.
        stand.setFlag('abe_last_activity', 'MegaSTP_SelectiveThinning_Select');
        stand.setFlag('abe_last_activity_year', Globals.year);
        stand.setFlag('abe_need_reassessment', false);
    }
};

// 6. Selective Thinning - Phase 2: Subsequent Removals
MEGA_STP_ACTIVITIES['selectiveThinning_remove'] = {
    id: 'MegaSTP_SelectiveThinning_Remove',
    type: 'scheduled',
    schedule: { signal: 'do_selectiveThinning_remove' },

    onEvaluate: function() { return true; },

    onExecute: function() {
        console.log(`[MEGA-STP] Executing 'selectiveThinning_remove' for stand ${stand.id}.`);

        // 1. Read the fraction to remove for this step, prepared by the agent.
        var fraction_to_remove = stand.flag('abe_param_fraction_to_remove') || 0;
        
        // 2. Load the REMAINING marked competitors.
        var remaining_competitors = stand.trees.load('markcompetitor=true');
        
        // 3. Calculate how many trees to remove from the *remaining* pool.
        var trees_to_remove_this_step = Math.ceil(remaining_competitors * fraction_to_remove);
        
        // 4. Filter the list down to the subset to remove and harvest them.
        stand.trees.filterRandom(trees_to_remove_this_step);
        var harvested_count = stand.trees.harvest();
        stand.trees.removeMarkedTrees();

        console.log(`[MEGA-STP] -> Subsequent removal: Harvested ${harvested_count} of ${remaining_competitors} remaining competitors.`);
    },

    onExecuted: function() {
        // Set completion flags for the agent to observe.
        stand.setFlag('abe_last_activity', 'MegaSTP_SelectiveThinning_Remove');
        stand.setFlag('abe_last_activity_year', Globals.year);
        stand.setFlag('abe_need_reassessment', false);
    }
};
### Answer
# Answer

Your signal-based STP implementation looks mostly correct, but there are a few issues and improvements to consider: iland-model:71-93 

## Issues Identified

### 1. **Plenter Activity: Incorrect `filterRandomExclude` Logic**

<cite />

In your `plenter` activity, this line is problematic:

```javascript
var treesToKeepInListForHarvest = treesInClass - (treesInClass - treesToHarvest);
stand.trees.filterRandomExclude(treesToKeepInListForHarvest);
```

The calculation simplifies to `treesToKeepInListForHarvest = treesToHarvest`, which means you're calling `filterRandomExclude(treesToHarvest)` - this keeps `treesToHarvest` trees and excludes the rest, which is backwards from what you want<cite />. 

**Fix:** You should use `filterRandom` instead to select only the trees to harvest:

```javascript
stand.trees.filterRandom(treesToHarvest);
```

Compare with the library implementation iland-model:286-298 , which uses `filterRandomExclude` correctly by calculating how many to *keep*, not remove.

### 2. **Selective Thinning: Event Handler Mismatch**

<cite />

For `selectiveThinning_select`, you're using `type: 'thinning'` with `thinning: 'selection'`, which means the C++ selection algorithm runs iland-model:121-144 . However, you're putting removal logic in `onExecuted`, which runs *after* the built-in `execute()` method iland-model:136-142 .

**Problem:** The built-in `execute()` already calls `removeMarkedTrees()` iland-model:138-141 , so your `onExecuted` logic won't find any marked trees - they're already removed!

**Fix:** Use `onExecute` instead to override the default behavior iland-model:129-136 :

```javascript
onExecute: function() {
    // Your custom removal logic here
    // This replaces the default removeMarkedTrees() behavior
}
```

Or better yet, don't override at all - let the selection algorithm mark trees, then use a separate `type: 'general'` activity triggered by signal to do the phased removal, similar to the library pattern iland-model:103-124 .

### 3. **Signal Coordination Pattern**

<cite />

Your approach of having the agent send signals (`do_plenter`, `do_selectiveThinning_select`, `do_selectiveThinning_remove`) is correct and matches how iLand's signal system works iland-model:122-143 . The activities will be queued for execution when the signal is received iland-model:131-136 .

## Recommended Structure

Based on the library implementation iland-model:71-124 , consider this pattern:

1. **Selection activity** (`type: 'thinning'`, `thinning: 'selection'`) - marks crop trees and competitors
2. **Removal activity** (`type: 'general'`) - performs phased removal of marked competitors

This separation is cleaner than trying to override `onExecuted` after the built-in removal has already occurred.

# Notes

- Your dynamic parameter functions (`N: function() { return stand.flag('abe_param_nTrees'); }`) are correct and will be evaluated at runtime iland-model:48-67 
- The signal-based scheduling (`schedule: { signal: 'do_plenter' }`) is the correct approach for agent-driven management iland-model:126-127 
- Consider using `lib.repeater()` if you need repeated executions of the same signal iland-model:95-101 

Wiki pages you might want to explore:
- [Management Activities (edfm-tum/iland-model)](/wiki/edfm-tum/iland-model#6.2)
- [Management Library (edfm-tum/iland-model)](/wiki/edfm-tum/iland-model#6.4)
### Citations
**File:** src/abe-lib/thinning/selective.js (L48-67)
```javascript
    function dynamic_nTrees() {
        // retrieve N from stand flag during runtime
        var value = stand.flag('nTrees');
        if (value === undefined) value = opts.nTrees;
        return value;
    };
    function dynamic_nCompetitors() {
        // retrieve N from stand flag during runtime
        //var value = stand.flag('nCompetitors');
        const Agefactor = Math.max(Math.min(1.0, -0.01*stand.age+1.2), 0.0);
        var value = Math.max(stand.flag('nCompetitors')*Agefactor, 1);
        if (value === undefined) value = opts.nCompetitors;
        return value;
    };

    // changing parameters if mode is dynamic
    if (opts.mode == 'dynamic') {
        opts.nTrees = dynamic_nTrees;
        opts.nCompetitors = dynamic_nCompetitors;
    };
```
**File:** src/abe-lib/thinning/selective.js (L71-124)
```javascript
    program["Selective_selector"] = {
        id: opts.id + '_selector',
        type: 'thinning',
        schedule: opts.schedule,	
        thinning: 'selection',
        N: opts.nTrees,
        NCompetitors: opts.nCompetitors, // total competitors! not per thinning event
        speciesSelectivity: opts.speciesSelectivity,
        ranking: opts.preferenceFunction,

        onSetup: function() { 
            lib.initStandObj(); // create an empty object as stand property
        },
    
        onEnter: function() {
            stand.obj.lib.selective_thinning_counter = 0;
        },

        onExit: function() {
            //lib.activityLog(opts.id + ' - thinning_selection done'); 
        },
        description: `Part of selective thinning - mark ${opts.nTrees} crop trees and ${opts.nCompetitors} competitors.`
    };

    program['Selective_repeater'] = lib.repeater({ 
        id: opts.id + '_repeater',
        schedule: opts.schedule,
        signal: opts.sendSignal,
        interval: opts.interval,
        count: opts.times 
    });

    program["Selective_remover"] = {
        id: opts.id + '_remover',
        type: 'general',
        schedule: { signal: opts.sendSignal },
        action: function() {
            if (stand.obj.lib.selective_thinning_counter == 0) {
                // first year. Save # of marked competitors
                const marked = stand.trees.load('markcompetitor=true');
                stand.setFlag('compN', marked);
                lib.dbg(`selectiveThinning: start removal phase. ${marked} trees marked for removal (Target was ${opts.nCompetitors*opts.nTrees}).`);
            }
            stand.obj.lib.selective_thinning_counter = stand.obj.lib.selective_thinning_counter + 1;
            var n = stand.flag('compN') / opts.times;

            stand.trees.load('markcompetitor=true');
            stand.trees.filterRandomExclude(n);
            const harvested = stand.trees.harvest();
            //lib.activityLog('thinning remove competitors'); 
            lib.dbg(`selectiveThinning: repeat ${stand.obj.lib.selective_thinning_counter}, removed ${harvested} trees.`);
        },
        description: `Part of selective thinning - remove selected competitors in ${opts.times} activies every ${opts.interval} years.`
    }
```
**File:** src/abe-lib/thinning/thinning.js (L286-298)
```javascript
			for (var i in dbhClasses) {
				var dbh = dbhClasses[i];
				// load all trees of dbh class [dbh-dbhSteps, dbh]
				var treesInClass = stand.trees.load('dbh>' + (dbh - opts.dbhSteps) + ' and dbh<=' + dbh);
				var targetCount = opts.plenterCurve[dbh] * stand.area;
				lib.dbg(`plenter activity - dbh class: ${dbh}: ${treesInClass} trees in Class, ${targetCount} trees target.`);

				var N = stand.trees.filterRandomExclude((treesInClass - targetCount) * opts.intensity);
				stand.trees.harvest();

				stand.trees.removeMarkedTrees();

				lib.dbg(`plenter activity - dbh class: ${dbh}: ${treesInClass - N} trees removed.`);
```
**File:** src/abe/actthinning.cpp (L121-144)
```cpp
bool ActThinning::execute(FMStand *stand)
{
    if (stand->trace()) qCDebug(abe) << stand->context() << "execute  activity" << name() << ":" << type();
    if (!stand->currentFlags().isScheduled()) {
        // if scheduling is off for this thinning activity,
        // then we need to invoke this manually.
        evaluate(stand);
    }
    if (events().hasEvent(QStringLiteral("onExecute"))) {
        // switch off simulation mode
        stand->currentFlags().setDoSimulate(false);
        // execute this event
        bool result =  Activity::execute(stand);
        stand->currentFlags().setDoSimulate(true);
        return result;
    } else {
        // default behavior: process all marked trees (harvest / cut)
        if (stand->trace()) qCDebug(abe) << stand->context() << "activity" << name() << "remove all marked trees.";
        FMTreeList trees(stand);
        trees.removeMarkedTrees();
        return true;
    }

}
```
**File:** src/abe/fmstp.cpp (L122-143)
```cpp
bool FMSTP::signal(QString signalstr, FMStand *stand, QJSValue parameter)
{
    int found = 0;
    for (auto *act : mActivities) {
        if (act->schedule().listensToSignal(signalstr)) {
            // only respond when the activity is enabled
            if (!stand->flags(act->index()).enabled())
                continue;

            int delta_yrs = act->schedule().signalExecutionDelay(signalstr);
            ForestManagementEngine::instance()->addRepeatActivity(stand->id(),
                                                                  act,
                                                                  delta_yrs,
                                                                  1,
                                                                  parameter);
            if (verbose())
                qCDebug(abe) << "Signal" << signalstr << "sent for stand" << stand->id() << "received by activity" << act->name() << "delta yrs:" << delta_yrs;
            ++found;
        }
    }
    return found > 0;
}
```
## Q2
I want to use schedule option so it is consistant with the other activites. But If I understand correctly the problem is based on the select activites trying to do 2 things at the same time ? it should only be a select and then a colect ? So If I first run the select and the next year the remove then could it fix the issue ? Because I guess it is what you mention I get in my log total competitor = 0, this is possible if all trees has already been removed
### Answer
# Answer

Yes, you've understood the problem correctly! iland-model:121-143 

## The Core Issue

When you use `type: 'thinning'` with `thinning: 'selection'`, the built-in `execute()` method automatically calls `removeMarkedTrees()` at line 140 iland-model:136-142 . This happens **before** your `onExecuted` event runs, so by the time your code tries to load marked competitors, they're already gone - hence `total_competitors = 0`.

## The Solution: Separate Selection and Removal

You're absolutely right that separating selection and removal into two activities is the correct approach. Here's how to fix it:

### 1. Selection Activity (Year 1)
Keep this as `type: 'thinning'` to mark trees, but **don't** try to remove them in `onExecuted`:

```javascript
MEGA_STP_ACTIVITIES['selectiveThinning_select'] = {
    id: 'MegaSTP_SelectiveThinning_Select',
    type: 'thinning',
    thinning: 'selection',
    schedule: { signal: 'do_selectiveThinning_select' },
    
    N: function() { return stand.flag('abe_param_nTrees'); },
    NCompetitors: function() { return stand.flag('abe_param_nCompetitors'); },
    speciesSelectivity: function() { return stand.flag('abe_param_speciesSelectivity') || {}; },
    ranking: 'height',

    onExecuted: function() {
        // Just count and store - don't remove anything
        var total_competitors = stand.trees.load('markcompetitor=true');
        stand.setFlag('abe_param_totalCompetitors', total_competitors);
        
        console.log(`[MEGA-STP] Selection complete: ${total_competitors} competitors marked.`);
        stand.setFlag('abe_last_activity', 'MegaSTP_SelectiveThinning_Select');
        stand.setFlag('abe_last_activity_year', Globals.year);
    }
};
```

### 2. Removal Activity (Year 2+)
Use `type: 'scheduled'` (or `'general'`) for the removal phase:

```javascript
MEGA_STP_ACTIVITIES['selectiveThinning_remove'] = {
    id: 'MegaSTP_SelectiveThinning_Remove',
    type: 'scheduled',
    schedule: { signal: 'do_selectiveThinning_remove' },

    onEvaluate: function() { return true; },

    onExecute: function() {
        var fraction_to_remove = stand.flag('abe_param_fraction_to_remove') || 0;
        var remaining_competitors = stand.trees.load('markcompetitor=true');
        var trees_to_remove = Math.ceil(remaining_competitors * fraction_to_remove);
        
        stand.trees.filterRandom(trees_to_remove);
        var harvested_count = stand.trees.harvest();
        stand.trees.removeMarkedTrees();

        console.log(`[MEGA-STP] Removed ${harvested_count} of ${remaining_competitors} competitors.`);
    }
};
```

This pattern matches the library implementation iland-model:71-93 , where the selector activity only marks trees iland-model:103-124 , and a separate `type: 'general'` remover activity handles the actual removal.

## Why This Works

The `type: 'scheduled'` activity uses `ActScheduled::execute()` iland-model:54-70 , which only calls `removeMarkedTrees()` if you **don't** provide an `onExecute` handler. Since you're providing `onExecute`, you have full control over when trees are removed.

# Notes

- Your agent should send `do_selectiveThinning_select` in year 1, then `do_selectiveThinning_remove` in subsequent years
- The marked competitors persist between years, so you can remove them gradually
- This separation is consistent with how the library handles selective thinning with repeaters iland-model:95-101 

Wiki pages you might want to explore:
- [Management Activities (edfm-tum/iland-model)](/wiki/edfm-tum/iland-model#6.2)
- [Management Library (edfm-tum/iland-model)](/wiki/edfm-tum/iland-model#6.4)
### Citations
**File:** src/abe/actthinning.cpp (L121-143)
```cpp
bool ActThinning::execute(FMStand *stand)
{
    if (stand->trace()) qCDebug(abe) << stand->context() << "execute  activity" << name() << ":" << type();
    if (!stand->currentFlags().isScheduled()) {
        // if scheduling is off for this thinning activity,
        // then we need to invoke this manually.
        evaluate(stand);
    }
    if (events().hasEvent(QStringLiteral("onExecute"))) {
        // switch off simulation mode
        stand->currentFlags().setDoSimulate(false);
        // execute this event
        bool result =  Activity::execute(stand);
        stand->currentFlags().setDoSimulate(true);
        return result;
    } else {
        // default behavior: process all marked trees (harvest / cut)
        if (stand->trace()) qCDebug(abe) << stand->context() << "activity" << name() << "remove all marked trees.";
        FMTreeList trees(stand);
        trees.removeMarkedTrees();
        return true;
    }

```
**File:** src/abe-lib/thinning/selective.js (L71-93)
```javascript
    program["Selective_selector"] = {
        id: opts.id + '_selector',
        type: 'thinning',
        schedule: opts.schedule,	
        thinning: 'selection',
        N: opts.nTrees,
        NCompetitors: opts.nCompetitors, // total competitors! not per thinning event
        speciesSelectivity: opts.speciesSelectivity,
        ranking: opts.preferenceFunction,

        onSetup: function() { 
            lib.initStandObj(); // create an empty object as stand property
        },
    
        onEnter: function() {
            stand.obj.lib.selective_thinning_counter = 0;
        },

        onExit: function() {
            //lib.activityLog(opts.id + ' - thinning_selection done'); 
        },
        description: `Part of selective thinning - mark ${opts.nTrees} crop trees and ${opts.nCompetitors} competitors.`
    };
```
**File:** src/abe-lib/thinning/selective.js (L95-101)
```javascript
    program['Selective_repeater'] = lib.repeater({ 
        id: opts.id + '_repeater',
        schedule: opts.schedule,
        signal: opts.sendSignal,
        interval: opts.interval,
        count: opts.times 
    });
```
**File:** src/abe-lib/thinning/selective.js (L103-124)
```javascript
    program["Selective_remover"] = {
        id: opts.id + '_remover',
        type: 'general',
        schedule: { signal: opts.sendSignal },
        action: function() {
            if (stand.obj.lib.selective_thinning_counter == 0) {
                // first year. Save # of marked competitors
                const marked = stand.trees.load('markcompetitor=true');
                stand.setFlag('compN', marked);
                lib.dbg(`selectiveThinning: start removal phase. ${marked} trees marked for removal (Target was ${opts.nCompetitors*opts.nTrees}).`);
            }
            stand.obj.lib.selective_thinning_counter = stand.obj.lib.selective_thinning_counter + 1;
            var n = stand.flag('compN') / opts.times;

            stand.trees.load('markcompetitor=true');
            stand.trees.filterRandomExclude(n);
            const harvested = stand.trees.harvest();
            //lib.activityLog('thinning remove competitors'); 
            lib.dbg(`selectiveThinning: repeat ${stand.obj.lib.selective_thinning_counter}, removed ${harvested} trees.`);
        },
        description: `Part of selective thinning - remove selected competitors in ${opts.times} activies every ${opts.interval} years.`
    }
```
**File:** src/abe/actscheduled.cpp (L54-70)
```cpp
bool ActScheduled::execute(FMStand *stand)
{
    if (events().hasEvent(QStringLiteral("onExecute"))) {
        // switch off simulation mode
        stand->currentFlags().setDoSimulate(false);
        // execute this event
        bool result =  Activity::execute(stand);
        stand->currentFlags().setDoSimulate(true);
        return result;
    } else {
        // default behavior: process all marked trees (harvest / cut)
        if (stand->trace()) qCDebug(abe) << stand->context() << "activity" << name() << "remove all marked trees.";
        FMTreeList trees(stand);
        trees.removeMarkedTrees();
        return true;
    }
}
```
## Q3
what do you think of this solution: 
The Real Problem: The Internal Logic of ActThinning::execute

I have re-examined the source code with your feedback in mind. The issue is fundamental to how an activity of type: 'thinning' behaves when it is not handled by the main scheduler (e.g., when triggered by a signal).

Here is the exact C++ execution flow inside ActThinning::execute (actthinning.cpp:121-144):

    The function is called.

    It checks if (!stand->currentFlags().isScheduled()). Since a signal-triggered activity is not considered "scheduled" by the main scheduler, this condition is true.

    Because the condition is true, it immediately calls evaluate(stand). For thinning: 'selection', this runs the C++ markCropTrees() algorithm. At this moment, the trees are successfully marked.

    The function then checks if (events().hasEvent(QStringLiteral("onExecute"))).

    If you do not provide an onExecute handler, it falls into the else block.

    The else block contains the default behavior: trees.removeMarkedTrees(). All the trees that were just marked in step 3 are immediately removed.

    After all of this, the onExecuted event is fired, but it's too late. The marked competitors are already gone, which is why your log correctly shows total competitors = 0.

You were right all along. The selection and the default removal were happening in the same single, atomic operation, and my previous suggestions failed to stop it.
The Correct Solution: Override onExecute to Block Default Behavior

The C++ code gives us a clear way to stop the default removal: we must provide an onExecute function. Its mere presence will cause the if condition to be true, skipping the else block entirely.

Here are the final, correct STP activities.
1. Corrected selectiveThinning_select Activity

Changes:

    An empty onExecute function has been added. Its only purpose is to override and block the default tree removal.

    The logic for the first removal has been moved to onExecuted, which is now safe to use because the default removal has been blocked.

code JavaScript

    
// In your mega_STP.js file

// 5. Selective Thinning - Phase 1: Select and First Removal
MEGA_STP_ACTIVITIES['selectiveThinning_select'] = {
    id: 'MegaSTP_SelectiveThinning_Select',
    type: 'thinning',
    thinning: 'selection',
    schedule: { signal: 'do_selectiveThinning_select' },

    // Parameters are read from flags at execution time.
    N: function() { return stand.flag('abe_param_nTrees'); },
    NCompetitors: function() { return stand.flag('abe_param_nCompetitors'); },
    // speciesSelectivity is now correctly handled.
    speciesSelectivity: function() { return stand.flag('abe_param_speciesSelectivity') || {}; },
    ranking: 'height',

    // --- THIS IS THE CRITICAL FIX ---
    // By providing an onExecute, we override the default behavior of ActThinning,
    // which would have been to immediately remove all marked trees.
    onExecute: function() {
        // This function is intentionally left empty.
        // The marking of trees happens automatically in the C++ backend
        // right before this function is called.
        console.log(`[MEGA-STP] SELECT phase: Marking complete. onExecute is blocking default removal.`);
    },
    // ---------------------------------

    // onExecuted runs AFTER onExecute. It is now safe to perform the first removal here.
    onExecuted: function() {
        console.log(`[MEGA-STP] SELECT phase (onExecuted): Performing initial removal.`);
        
        var total_times = stand.flag('abe_param_times') || 1;
        
        var total_competitors = stand.trees.load('markcompetitor=true');
        stand.setFlag('abe_param_totalCompetitors', total_competitors);
        
        var fraction_to_remove = 1 / total_times;
        var trees_to_remove_this_step = Math.ceil(total_competitors * fraction_to_remove);

        stand.trees.filterRandom(trees_to_remove_this_step);
        var harvested_count = stand.trees.harvest();
        stand.trees.removeMarkedTrees();

        console.log(`[MEGA-STP] -> Initial removal: Harvested ${harvested_count} of ${total_competitors} total competitors.`);
        
        stand.setFlag('abe_selective_thinning_initialized', true);
        stand.setFlag('abe_last_activity', 'MegaSTP_SelectiveThinning_Select');
        stand.setFlag('abe_last_activity_year', Globals.year);
        stand.setFlag('abe_need_reassessment', false);
    }
};

  

2. Corrected selectiveThinning_remove Activity

This activity was already using onExecute, so its structure was correct. I have double-checked its logic to ensure it correctly calculates the share to remove based on the initial total, which is the robust method used in the abe-lib.
code JavaScript

    
// In your mega_STP.js file

// 6. Selective Thinning - Phase 2: Subsequent Removals
MEGA_STP_ACTIVITIES['selectiveThinning_remove'] = {
    id: 'MegaSTP_SelectiveThinning_Remove',
    type: 'scheduled',
    schedule: { signal: 'do_selectiveThinning_remove' },

    onEvaluate: function() { return true; },

    onExecute: function() {
        console.log(`[MEGA-STP] Executing 'selectiveThinning_remove' for stand ${stand.id}.`);

        // Read the initial total number of competitors that was stored by the _select activity.
        var total_competitors = stand.flag('abe_param_totalCompetitors') || 0;
        var total_times = stand.flag('abe_param_times') || 1;
        
        // Calculate the number of trees that SHOULD be removed in each step.
        var trees_per_step = Math.ceil(total_competitors / total_times);
        
        // Load the currently REMAINING marked competitors.
        var remaining_competitors = stand.trees.load('markcompetitor=true');
        
        // Harvest up to 'trees_per_step', but no more than what is actually left.
        var trees_to_remove_this_step = Math.min(trees_per_step, remaining_competitors);
        
        stand.trees.filterRandom(trees_to_remove_this_step);
        var harvested_count = stand.trees.harvest();
        stand.trees.removeMarkedTrees();

        console.log(`[MEGA-STP] -> Subsequent removal: Harvested ${harvested_count} of ${remaining_competitors} remaining competitors.`);
    },

    onExecuted: function() {
        stand.setFlag('abe_last_activity', 'MegaSTP_SelectiveThinning_Remove');
        stand.setFlag('abe_last_activity_year', Globals.year);
        stand.setFlag('abe_need_reassessment', false);
    }
};
### Answer
# Answer

Your analysis is **absolutely correct**! iland-model:121-144 

You've identified the exact issue: when a `type: 'thinning'` activity is triggered by a signal (not scheduled), the `!stand->currentFlags().isScheduled()` condition at line 124 is true iland-model:124-128 , which causes `evaluate(stand)` to run (marking the trees), and then if there's no `onExecute` handler, it immediately calls `removeMarkedTrees()` at line 140 iland-model:136-142 .

## Your Solution is Perfect

By providing an empty `onExecute` function, you trigger the `if` branch at line 129 iland-model:129-135 , which:
1. Switches off simulation mode
2. Calls `Activity::execute(stand)` (which runs your `onExecute`)
3. Switches simulation mode back on
4. **Skips the `else` block entirely** - no automatic `removeMarkedTrees()`!

Then `onExecuted` fires afterward (from the base activity execution flow iland-model:388-390 ), and at that point the marked trees are still present, so you can safely load and manipulate them.

## Verification from Library Code

This pattern is actually used in the library! Look at the `selectiveThinningZ1Z2` implementation iland-model:234-262 : the selection activity has `onCreate: function(act) { act.scheduled=false; }` at line 246 iland-model:245-250 , which forces the same code path you're dealing with. The removal is then handled by a separate `type: 'general'` activity iland-model:412-437 .

Your approach of using `onExecute` to block the default removal and then doing custom removal in `onExecuted` is a valid alternative that keeps everything in one activity for the initial selection+removal phase.

## Minor Suggestion

Your `selectiveThinning_remove` logic looks good. The calculation using `total_competitors / total_times` ensures equal distribution across all removal steps, which matches the library pattern iland-model:424-431 .

# Notes

- The key insight is that `onExecute`'s presence changes the execution path in `ActThinning::execute()`, preventing the automatic `removeMarkedTrees()` call
- For `type: 'scheduled'` activities, the same logic applies in `ActScheduled::execute()` iland-model:54-70 
- Your solution maintains consistency with signal-based scheduling while giving you full control over the removal timing

Wiki pages you might want to explore:
- [Forest Management (ABE) (edfm-tum/iland-model)](/wiki/edfm-tum/iland-model#6)
- [Management Library (edfm-tum/iland-model)](/wiki/edfm-tum/iland-model#6.4)
### Citations
**File:** src/abe/actthinning.cpp (L121-144)
```cpp
bool ActThinning::execute(FMStand *stand)
{
    if (stand->trace()) qCDebug(abe) << stand->context() << "execute  activity" << name() << ":" << type();
    if (!stand->currentFlags().isScheduled()) {
        // if scheduling is off for this thinning activity,
        // then we need to invoke this manually.
        evaluate(stand);
    }
    if (events().hasEvent(QStringLiteral("onExecute"))) {
        // switch off simulation mode
        stand->currentFlags().setDoSimulate(false);
        // execute this event
        bool result =  Activity::execute(stand);
        stand->currentFlags().setDoSimulate(true);
        return result;
    } else {
        // default behavior: process all marked trees (harvest / cut)
        if (stand->trace()) qCDebug(abe) << stand->context() << "activity" << name() << "remove all marked trees.";
        FMTreeList trees(stand);
        trees.removeMarkedTrees();
        return true;
    }

}
```
**File:** src/abe/fmstand.cpp (L388-390)
```cpp
            // run the onExecuted handler also for repeating activities
            currentActivity()->events().run(QStringLiteral("onExecuted"),this);
        }
```
**File:** src/abe-lib/thinning/selective.js (L234-262)
```javascript
    const select_trees = {
        type: 'thinning',
        thinning: 'selection',
        id: opts.id + '_repeating',
        schedule: { signal: opts.sendSignalPeriode },	
        constraint: opts.constraint,
        N: opts.nTrees,
        NCompetitors: opts.nCompetitors, 
        speciesSelectivity: opts.speciesSelectivity,
        ranking: opts.preferenceFunction + ' * (height < 25)',
    
        onCreate: function(act) { 
            act.scheduled=false; /* this makes sure that evaluate is also called when invoked by a signal */ 
            console.log(`onCreate: ${opts.id}: `);
            printObj(this);
            console.log('---end---');							  
        },
    
        onEnter: function() {
            lib.dbg("Hello world");
            stand.obj.lib.selective_thinning_counter = 0;
        },
    
        onExecuted: function() {
            lib.dbg("Select trees in stand " + stand.id + " executed.");
			stand.stp.signal('selective_start_thinning');
            //lib.activityLog('thinning_selection'); 
        },
        description: `Selective thinning. Repeated ${opts.times} times every ${opts.interval} years.`
```
**File:** src/abe-lib/thinning/selective.js (L412-437)
```javascript
    program["Selective_remover"] = {
        id: opts.id + '_remover',
        type: 'general',
        schedule: { signal: 'selective_thinning_remove'},
        action: function() {
            if (stand.obj.lib.selective_thinning_counter == 0) {
                // first year. Save # of marked competitors
                const marked = stand.trees.load('markcompetitor=true');
                stand.setFlag('compN', marked);
                lib.dbg(`selectiveThinning: start removal phase. ${marked} trees marked for removal.`);
            }
            stand.obj.lib.selective_thinning_counter = stand.obj.lib.selective_thinning_counter + 1;
            var n = stand.flag('compN') / opts.times;


            lib.log("Year: " + Globals.year + ", selective thinning harvest");

            stand.trees.load('markcompetitor=true');
            stand.trees.filterRandomExclude(n);
            const harvested = stand.trees.harvest();
            //lib.activityLog('thinning remove competitors'); // details? target species?
            //stand.trees.removeMarkedTrees(); // ? necessary ??
            lib.dbg(`selectiveThinning: repeat ${stand.obj.lib.selective_thinning_counter}, removed ${harvested} trees.`);
        },
        description: `Selective thinning (every ${opts.times} years), that removes all trees above a target diameter ( ${opts.TargetDBH} cm)).`
    }
```
**File:** src/abe/actscheduled.cpp (L54-70)
```cpp
bool ActScheduled::execute(FMStand *stand)
{
    if (events().hasEvent(QStringLiteral("onExecute"))) {
        // switch off simulation mode
        stand->currentFlags().setDoSimulate(false);
        // execute this event
        bool result =  Activity::execute(stand);
        stand->currentFlags().setDoSimulate(true);
        return result;
    } else {
        // default behavior: process all marked trees (harvest / cut)
        if (stand->trace()) qCDebug(abe) << stand->context() << "activity" << name() << "remove all marked trees.";
        FMTreeList trees(stand);
        trees.removeMarkedTrees();
        return true;
    }
}
```
## Q4
Test_Scenarios.verify_selection_on_all_stands = function(agent, current_year) {
    
    const TEST_YEAR = 2;

    // --- Guard Clause: Only run this test in the specified year ---
    if (current_year !== TEST_YEAR) {
        return true; 
    }

    // --- The test logic will now run for EVERY agent that is passed to this function ---

    console.log(`\n[TEST] ==================== YEAR ${current_year} - Testing ALL stands for Agent ${agent.id} ====================`);

    // --- Iterate over every stand for this agent ---
    for (const stand_id_key in agent.managed_stands_data) {
        const stand_id = parseInt(stand_id_key);
        const stand_data = agent.managed_stands_data[stand_id];
        
        console.log(`\n--- Testing Stand ${stand_id} ---`);

        // --- 1. PREPARE THE PLAN ---
        // We force the same aggressive plan on every stand to test the algorithm's response.
        stand_data.activity = {
            chosen_Activity: 'selectiveThinning',
            parameters: { nTrees: 250, nCompetitors: 5 }, // species_profile is omitted as per your change
            target_year: TEST_YEAR,
            is_actionable: true 
        };
        
        // --- 2. TRIGGER THE ACTION ---
        // This queues the activity for execution by the C++ engine.
        Action.trigger_activity(stand_data);
    }
    
    console.log(`\n[TEST] All signals fired for agent ${agent.id}. The activities will execute shortly.`);
    console.log(`[TEST] Check the [MEGA-STP] logs that follow for results from each stand.`);

    // We return true to prevent the agent from doing anything else this year,
    // but the next agent in the main loop will still have its turn to run this test.
    return true; 
};

I am running this test with this STP 

// 5. Selective Thinning - Phase 1: Select and First Removal
MEGA_STP_ACTIVITIES['selectiveThinning_select'] = {
    id: 'MegaSTP_SelectiveThinning_Select',
    type: 'thinning',
    thinning: 'selection',
    schedule: { signal: 'do_selectiveThinning_select' },

    // Parameters are read from flags at execution time.
    N: function() { return stand.flag('abe_param_nTrees'); },
    NCompetitors: function() { return stand.flag('abe_param_nCompetitors'); },
   // speciesSelectivity: function() { return stand.flag('abe_param_speciesSelectivity') || {}; },
    ranking: 'height',

    // --- THIS IS THE CRITICAL FIX ---
    // By providing an onExecute, we override the default behavior of ActThinning,
    // which would have been to immediately remove all marked trees.
    onExecute: function() {
        // This function is intentionally left empty.
        // The marking of trees happens automatically in the C++ backend
        // right before this function is called.
        console.log(`[MEGA-STP - onExecute] SELECT phase for stand ${stand.id}. Marking has occurred. onExecute is blocking default removal.`);
    },
    // ---------------------------------

    // onExecuted runs AFTER onExecute. It is now safe to perform the first removal here.
    onExecuted: function() {
        console.log(`[MEGA-STP - onExecuted] SELECT phase for stand ${stand.id}. Performing initial removal.`);
        
        // 1. Check how many competitors were marked by the C++ algorithm.
        var total_competitors = stand.trees.load('markcompetitor=true');
        console.log(`  -> Found ${total_competitors} marked competitors.`);
        
        if (total_competitors === 0) {
            console.warn(`  -> WARNING: No competitors were marked. This could be due to low stand density or no available candidates.`);
        }
        stand.setFlag('abe_param_totalCompetitors', total_competitors);
        
        // 2. Calculate and perform the first removal based on the 'times' parameter.
        var total_times = stand.flag('abe_param_times') || 1;
        var fraction_to_remove = (total_times > 0) ? (1 / total_times) : 0;
        var trees_to_remove_this_step = Math.ceil(total_competitors * fraction_to_remove);

        stand.trees.filterRandom(trees_to_remove_this_step);
        var harvested_count = stand.trees.harvest();
        stand.trees.removeMarkedTrees();

        console.log(`  -> Initial removal: Harvested ${harvested_count} of ${total_competitors} total competitors.`);
        
        // 3. Set persistent and completion flags for the agent to observe.
        stand.setFlag('abe_selective_thinning_initialized', true);
        stand.setFlag('abe_last_activity', 'MegaSTP_SelectiveThinning_Select');
        stand.setFlag('abe_last_activity_year', Globals.year);
        stand.setFlag('abe_need_reassessment', false);
    }
};
// 6. Selective Thinning - Phase 2: Subsequent Removals
MEGA_STP_ACTIVITIES['selectiveThinning_remove'] = {
    id: 'MegaSTP_SelectiveThinning_Remove',
    type: 'scheduled',
    schedule: { signal: 'do_selectiveThinning_remove' },

    onEvaluate: function() { return true; },

    onExecute: function() {
        console.log(`[MEGA-STP - onExecute] REMOVE phase for stand ${stand.id}.`);

        // 1. Read the fraction to remove for this specific step, prepared by the agent.
        var fraction_to_remove = stand.flag('abe_param_fraction_to_remove') || 0;
        
        // 2. Load the REMAINING marked competitors.
        var remaining_competitors = stand.trees.load('markcompetitor=true');
        console.log(`  -> Found ${remaining_competitors} remaining competitors.`);
        
        // 3. Calculate how many trees to remove from the *remaining* pool.
        var trees_to_remove_this_step = Math.ceil(remaining_competitors * fraction_to_remove);
        
        // 4. Filter the list down to the subset to remove and harvest them.
        stand.trees.filterRandom(trees_to_remove_this_step);
        var harvested_count = stand.trees.harvest();
        stand.trees.removeMarkedTrees();

        console.log(`  -> Subsequent removal: Harvested ${harvested_count} of ${remaining_competitors} remaining competitors.`);
    },

    onExecuted: function() {
        console.log(`[MEGA-STP - onExecuted] REMOVE phase complete for stand ${stand.id}.`);
        // Set completion flags for the agent to observe.
        stand.setFlag('abe_last_activity', 'MegaSTP_SelectiveThinning_Remove');
        stand.setFlag('abe_last_activity_year', Globals.year);
        stand.setFlag('abe_need_reassessment', false);
    }
};

yet no tree are ever marked... any idea why ?
### Answer
# Answer

You're encountering an issue where the selective thinning algorithm isn't marking any trees. The problem is likely that the C++ `markCropTrees()` function is being called, but it's not finding enough suitable trees to mark based on your parameters. iland-model:488-494 

## Root Cause Analysis

The `evaluateSelective()` function calls `markCropTrees()` which performs the actual marking iland-model:497-647 . Here's what happens:

1. **Parameter Evaluation**: The function evaluates your dynamic parameters `N` and `NCompetitors` iland-model:505-511 

2. **Target Calculation**: It calculates `target_n = selective_n * stand->area()` iland-model:524-527 

3. **Tree Ranking**: Trees are sorted by height (or your ranking expression) iland-model:542-551 

4. **Spatial Selection**: The algorithm uses a 2m grid to ensure spatial distribution of crop trees iland-model:518-522 

## Likely Issues

### 1. **Missing Stand Flags**

Your `Action.trigger_activity()` sets parameters in `stand_data.activity.parameters`, but the STP reads from **stand flags**:

```javascript
N: function() { return stand.flag('abe_param_nTrees'); },
NCompetitors: function() { return stand.flag('abe_param_nCompetitors'); },
```

**You need to set these flags BEFORE triggering the signal**. In your `Action.trigger_activity()` function, you should do:

```javascript
stand.setFlag('abe_param_nTrees', stand_data.activity.parameters.nTrees);
stand.setFlag('abe_param_nCompetitors', stand_data.activity.parameters.nCompetitors);
```

### 2. **Stand Density Too Low**

With `nTrees: 250` per hectare, if your stands are small or have low tree density, the algorithm might not find enough trees. The algorithm has safety checks iland-model:526-533 :

```cpp
if (target_n>=treelist->trees().count())
    target_n = treelist->trees().count();
```

If the stand has fewer than 250 trees per hectare, it will adjust, but if it has very few trees total, marking might fail.

### 3. **Spatial Distribution Constraints**

The algorithm uses a 7x7 kernel on a 2m grid to ensure crop trees are spatially distributed iland-model:556-610 . If trees are too clustered, it might not find enough valid positions. The algorithm runs multiple passes with increasingly relaxed thresholds iland-model:585-610 , but it can still fail if the stand structure doesn't support the target density.

## Debugging Steps

Add this diagnostic code to your `onExecute` to see what's happening:

```javascript
onExecute: function() {
    console.log(`[MEGA-STP - onExecute] SELECT phase for stand ${stand.id}.`);
    console.log(`  -> N parameter: ${stand.flag('abe_param_nTrees')}`);
    console.log(`  -> NCompetitors parameter: ${stand.flag('abe_param_nCompetitors')}`);
    console.log(`  -> Stand area: ${stand.area} ha`);
    console.log(`  -> Total trees in stand: ${stand.trees.loadAll()}`);
    console.log(`  -> Target crop trees: ${stand.flag('abe_param_nTrees') * stand.area}`);
},
```

## Solution

**Fix your `Action.trigger_activity()` function** to set the stand flags before sending the signal:

```javascript
Action.trigger_activity = function(stand_data) {
    // Set the flags that the STP will read
    stand.setFlag('abe_param_nTrees', stand_data.activity.parameters.nTrees);
    stand.setFlag('abe_param_nCompetitors', stand_data.activity.parameters.nCompetitors);
    
    // Now send the signal
    stand.stp.signal('do_selectiveThinning_select');
};
```

# Notes

- The library's selective thinning implementation uses the same pattern of reading from stand flags iland-model:48-67 , so this is the expected approach
- The C++ marking algorithm is quite sophisticated with spatial constraints - if you're testing on young/sparse stands, consider lowering `nTrees` to something more realistic like 80-100 per hectare iland-model:29-34 
- The algorithm logs detailed information when `FMSTP::verbose()` is true iland-model:642-645  - you might want to enable verbose logging to see what's happening internally

Wiki pages you might want to explore:
- [Forest Management (ABE) (edfm-tum/iland-model)](/wiki/edfm-tum/iland-model#6)
- [Management Library (edfm-tum/iland-model)](/wiki/edfm-tum/iland-model#6.4)
### Citations
**File:** src/abe/actthinning.cpp (L488-494)
```cpp
bool ActThinning::evaluateSelective(FMStand *stand)
{
    QJSValue result = FMSTP::evaluateJS(mSelectiveThinning.speciesProb);
    bool selective_species = populateSpeciesSelectivity(result);

    markCropTrees(stand, selective_species);
    return true;
```
**File:** src/abe/actthinning.cpp (L497-647)
```cpp
bool ActThinning::markCropTrees(FMStand *stand, bool selective_species)
{
    // tree list from current exeution context
    FMTreeList *treelist = ForestManagementEngine::instance()->scriptBridge()->treesObj();
    treelist->setStand(stand);
    treelist->loadAll();
    clearTreeMarks(treelist);

    // evaluate dynamic variables
    double selective_n = FMSTP::evaluateJS(mSelectiveThinning.N).toInt();
    if (selective_n == 0. || isnan(selective_n))
        throw IException(QString("Invalid value for 'N' in selective Thinning: '%1'").arg(selective_n));
    double selective_competitor = FMSTP::evaluateJS(mSelectiveThinning.Ncompetitors).toNumber();
    if (selective_competitor == 0. || isnan(selective_competitor))
        throw IException(QString("Invalid value for 'NCompetitors' in selective Thinning: '%1'").arg(selective_competitor));

    QString selective_ranking_expr = FMSTP::evaluateJS(mSelectiveThinning.rankingExpr).toString();
    if (selective_ranking_expr == "undefined")
        selective_ranking_expr.clear();

    // get the 2x2m grid for the current stand
    Grid<float> &grid = treelist->localStandGrid();
    // clear (except the out of "stand" pixels)
    for (float *p=grid.begin(); p!=grid.end(); ++p)
        if (*p > -1.f)
            *p = 0.f;

    int target_n = selective_n * stand->area();

    if (target_n>=treelist->trees().count())
        target_n = treelist->trees().count();

    qCDebug(abe) << "using user-defined number of competitors: " << selective_competitor;

    int max_target_n = qMax(target_n * 1.5, treelist->trees().count()/2.);
    if (max_target_n>=treelist->trees().count())
        max_target_n = treelist->trees().count();
    // we have 2500 px per ha (2m resolution)
    // if each tree dominates its Moore-neighborhood, 2500/9 = 267 trees are possible (/ha)
    // if *more* trees should be marked, some trees need to be on neighbor pixels:
    // pixels = 2500 / N; if 9 px are the Moore neighborhood, the "overprint" is N*9 / 2500.
    // N*9/2500 -1 = probability of having more than zero overlapping pixels
    //double overprint = (mSelectiveThinning.N * 9) / double(cPxPerHectare) - 1.;
    //double overprint = (mSelectiveThinning.N * 49) / double(cPxPerHectare) - 1.; // JM: Adjusted, since we have a 7x7 Kernle now instead of 3x3

    // rank the trees according to their ranking
    if (selective_ranking_expr.isEmpty()) {
        // order the list of trees according to tree height
        treelist->sort("-height");
    } else {
        // order the list of trees according to a user defined ranking expression
        treelist->sort(QString("-(%1)").arg(selective_ranking_expr));
        qCDebug(abe) << "using user-defined ranking for selective thinning: " << selective_ranking_expr;

    }

    qCDebug(abe) << "Target number of crop trees: " << target_n;


    // start with a part of N and 0 overlap
    int n_found = 0;
    int tests=0;
    int i=0;
    while (n_found < target_n/3 && i<target_n/2) {
        float f=testPixel(treelist->trees().at(i).first->position(), grid); ++tests;
        if (f==0.f) {
            // no neighbors: check species
            if (!selective_species ||
                drandom() < mSpeciesSelectivity[treelist->trees().at(i).first->species()]) {

                // found! Now mark as crop trees
                setPixel(treelist->trees().at(i).first->position(), grid);
                treelist->trees()[i].first->markCropTree(true);
                ++n_found;

            }
        }
        ++i;
    }



    qCDebug(abe) << "numbers found in first round: " << n_found;




    // continue with a higher probability
    for (int run=0;run<4;++run) {
        for (int i=0; i<max_target_n;++i) {
            if (treelist->trees().at(i).first->isMarkedAsCropTree())
                continue;

            float f=testPixel(treelist->trees().at(i).first->position(), grid); ++tests;

            if ((f==0.f) ||
                (f<=(0.0805*selective_n-2.4256)) ||                  // JM: define kernel thresholds here     scaled: max(0, 0.0805*selective_n-2.4256)
                (run==1 && f<=(0.1484*selective_n-5.4919)) ||        // JM: define kernel thresholds here     scaled: max(0, 0.1484*selective_n-5.4919)
                (run==2 && f<=(0.1679*selective_n-4.8988)) ||        // JM: define kernel thresholds here     scaled: max(0, 0.1679*selective_n-4.8988)
                ((run==3) && f<=(4*(0.1679*selective_n-4.8988)))) {  // JM: define kernel thresholds here     scaled: max(0, 0.0805*selective_n-2.4256) or 4*(0.1679*selective_n-4.8988)

                if (selective_species & !( drandom() < mSpeciesSelectivity[treelist->trees().at(i).first->species()]) )
                    continue;

                setPixel(treelist->trees().at(i).first->position(), grid);
                treelist->trees()[i].first->markCropTree(true);
                ++n_found;
                if (n_found == target_n)
                    break;
            }
        }
        if (n_found==target_n)
            break;
    }

    // now mark the competitors:
    // competitors are trees up to 75th percentile of the tree population that
    int n_competitor=0;
    int target_competitors = std::round(selective_competitor * target_n);

    int max_target_n_competitor = qMax(target_competitors * 1.5, treelist->trees().count()/2.);
    if (max_target_n_competitor>=treelist->trees().count())
        max_target_n_competitor = treelist->trees().count();


    for (int run=0;run<3 && n_competitor<target_competitors;++run) {
        for (int i=0; i<max_target_n_competitor;++i) {
            Tree *tree = treelist->trees().at(i).first;
            if (tree->isMarkedAsCropTree() || tree->isMarkedAsCropCompetitor())
                continue;

            float f=testPixel(treelist->trees().at(i).first->position(), grid); ++tests;

            if ( (f>1.f) ||            // 12.f
                 (run==1 && f>0.5) ||     // 8.f
                 (run==2)) {    // 4.f
                tree->markCropCompetitor(true);
                n_competitor++;
                if (n_competitor >= target_competitors)
                    break;
            }
        }
    }


    if (FMSTP::verbose()) {
        qCDebug(abe) << stand->context() << "Thinning::markCropTrees: marked" << n_found << "(plan:" << target_n << ") from total" << treelist->trees().count()
                     << ". Tests performed:" << tests << "marked as competitors:" << n_competitor;
    }
    return n_found==target_n;

```
**File:** src/abe-lib/thinning/selective.js (L29-34)
```javascript
    const defaultOptions = {
        id: 'SelectiveThinning',
        schedule: undefined,
        mode: 'simple',
        nTrees: 80,
        nCompetitors: 4,
```
**File:** src/abe-lib/thinning/selective.js (L48-67)
```javascript
    function dynamic_nTrees() {
        // retrieve N from stand flag during runtime
        var value = stand.flag('nTrees');
        if (value === undefined) value = opts.nTrees;
        return value;
    };
    function dynamic_nCompetitors() {
        // retrieve N from stand flag during runtime
        //var value = stand.flag('nCompetitors');
        const Agefactor = Math.max(Math.min(1.0, -0.01*stand.age+1.2), 0.0);
        var value = Math.max(stand.flag('nCompetitors')*Agefactor, 1);
        if (value === undefined) value = opts.nCompetitors;
        return value;
    };

    // changing parameters if mode is dynamic
    if (opts.mode == 'dynamic') {
        opts.nTrees = dynamic_nTrees;
        opts.nCompetitors = dynamic_nCompetitors;
    };
```
## Q5
how can I be sure that the algorithm is actually working ?
### Answer
You're asking how to verify that the selective thinning algorithm in iLand's ABE system is actually executing and marking trees correctly. iland-model:498-646 

## Verification Methods

### 1. **Enable Verbose Logging**

The C++ marking algorithm outputs detailed debug information when verbose mode is enabled iland-model:641-644 :

```cpp
if (FMSTP::verbose()) {
    qCDebug(abe) << stand->context() << "Thinning::markCropTrees: marked" << n_found 
                 << "(plan:" << target_n << ") from total" << treelist->trees().count()
                 << ". Tests performed:" << tests << "marked as competitors:" << n_competitor;
}
```

This will show you:
- How many crop trees were actually marked vs. the target
- Total trees in the stand
- Number of spatial tests performed
- Number of competitors marked

### 2. **Check Tree Flags in Output**

Enable the `treeremoved` output to see the marking flags on harvested trees iland-model:98-107 . The `treeFlags` column contains binary flags including:
- `MarkCropTree` (2048)
- `MarkCropCompetitor` (4096)

You can verify trees were marked before removal by checking these flags in your output database.

### 3. **Add Diagnostic Logging in Your STP**

Enhance your `onExecute` to verify the algorithm ran iland-model:498-510 :

```javascript
onExecute: function() {
    console.log(`[MEGA-STP - onExecute] SELECT phase for stand ${stand.id}.`);
    
    // Check parameters BEFORE marking
    var n_param = stand.flag('abe_param_nTrees');
    var ncomp_param = stand.flag('abe_param_nCompetitors');
    console.log(`  -> Parameters: N=${n_param}, NCompetitors=${ncomp_param}`);
    console.log(`  -> Stand area: ${stand.area} ha`);
    console.log(`  -> Target crop trees: ${n_param * stand.area}`);
    
    // Load all trees to check density
    var total_trees = stand.trees.loadAll();
    console.log(`  -> Total trees in stand: ${total_trees}`);
    console.log(`  -> Trees per hectare: ${total_trees / stand.area}`);
    
    // The C++ algorithm runs here automatically
},
```

### 4. **Verify Marking in `onExecuted`**

Your current code already does this, but you can expand it iland-model:612-640 :

```javascript
onExecuted: function() {
    // Count marked crop trees
    var marked_crop = stand.trees.load('markcrop=true');
    console.log(`  -> Marked crop trees: ${marked_crop}`);
    
    // Count marked competitors
    var marked_competitors = stand.trees.load('markcompetitor=true');
    console.log(`  -> Marked competitors: ${marked_competitors}`);
    
    // Verify against targets
    var target_crop = stand.flag('abe_param_nTrees') * stand.area;
    var target_comp = stand.flag('abe_param_nCompetitors') * target_crop;
    console.log(`  -> Target crop trees: ${target_crop}`);
    console.log(`  -> Target competitors: ${target_comp}`);
    
    if (marked_crop === 0 && marked_competitors === 0) {
        console.error(`  -> ERROR: Algorithm marked ZERO trees!`);
    }
}
```

### 5. **Check ABE Stand Removal Output**

Enable the `abeStandRemoval` output iland-model:29-46  to track harvested volumes. If the algorithm is working, you should see non-zero `volumeThinning` values for stands where selective thinning executed.

### 6. **Verify Stand Flags Are Set**

The most common issue is that stand flags aren't set before the signal fires. Add this to your `Action.trigger_activity()`:

```javascript
Action.trigger_activity = function(stand_data) {
    var stand = Globals.standById(stand_data.stand_id);
    
    // Set flags BEFORE sending signal
    stand.setFlag('abe_param_nTrees', stand_data.activity.parameters.nTrees);
    stand.setFlag('abe_param_nCompetitors', stand_data.activity.parameters.nCompetitors);
    
    // Verify flags were set
    console.log(`[Action] Set flags for stand ${stand.id}: N=${stand.flag('abe_param_nTrees')}, NComp=${stand.flag('abe_param_nCompetitors')}`);
    
    // Now trigger the signal
    stand.stp.signal('do_selectiveThinning_select');
};
```

## Expected Behavior

If the algorithm is working correctly, you should see:
1. Your `onExecute` log showing parameters were read
2. Verbose C++ logs (if enabled) showing the marking process
3. Your `onExecuted` log showing non-zero marked trees
4. Harvest output showing removed volume

If you see `marked_competitors = 0` in `onExecuted`, the algorithm either:
- Didn't run (flags not set)
- Ran but found no suitable trees (stand too sparse/young)
- Ran but spatial constraints prevented marking iland-model:555-610 

## Notes

The spatial selection algorithm is quite strict - it uses a 7x7 kernel on a 2m grid to ensure crop trees are well-distributed iland-model:517-521 . With `nTrees: 250` per hectare, you're asking for very high density that may not be achievable in young or sparse stands. The library defaults to 80 trees/ha for a reason iland-model:28-34 .

Wiki pages you might want to explore:
- [Forest Management (ABE) (edfm-tum/iland-model)](/wiki/edfm-tum/iland-model#6)
- [Management Library (edfm-tum/iland-model)](/wiki/edfm-tum/iland-model#6.4)
### Citations
**File:** src/abe/actthinning.cpp (L498-646)
```cpp
{
    // tree list from current exeution context
    FMTreeList *treelist = ForestManagementEngine::instance()->scriptBridge()->treesObj();
    treelist->setStand(stand);
    treelist->loadAll();
    clearTreeMarks(treelist);

    // evaluate dynamic variables
    double selective_n = FMSTP::evaluateJS(mSelectiveThinning.N).toInt();
    if (selective_n == 0. || isnan(selective_n))
        throw IException(QString("Invalid value for 'N' in selective Thinning: '%1'").arg(selective_n));
    double selective_competitor = FMSTP::evaluateJS(mSelectiveThinning.Ncompetitors).toNumber();
    if (selective_competitor == 0. || isnan(selective_competitor))
        throw IException(QString("Invalid value for 'NCompetitors' in selective Thinning: '%1'").arg(selective_competitor));

    QString selective_ranking_expr = FMSTP::evaluateJS(mSelectiveThinning.rankingExpr).toString();
    if (selective_ranking_expr == "undefined")
        selective_ranking_expr.clear();

    // get the 2x2m grid for the current stand
    Grid<float> &grid = treelist->localStandGrid();
    // clear (except the out of "stand" pixels)
    for (float *p=grid.begin(); p!=grid.end(); ++p)
        if (*p > -1.f)
            *p = 0.f;

    int target_n = selective_n * stand->area();

    if (target_n>=treelist->trees().count())
        target_n = treelist->trees().count();

    qCDebug(abe) << "using user-defined number of competitors: " << selective_competitor;

    int max_target_n = qMax(target_n * 1.5, treelist->trees().count()/2.);
    if (max_target_n>=treelist->trees().count())
        max_target_n = treelist->trees().count();
    // we have 2500 px per ha (2m resolution)
    // if each tree dominates its Moore-neighborhood, 2500/9 = 267 trees are possible (/ha)
    // if *more* trees should be marked, some trees need to be on neighbor pixels:
    // pixels = 2500 / N; if 9 px are the Moore neighborhood, the "overprint" is N*9 / 2500.
    // N*9/2500 -1 = probability of having more than zero overlapping pixels
    //double overprint = (mSelectiveThinning.N * 9) / double(cPxPerHectare) - 1.;
    //double overprint = (mSelectiveThinning.N * 49) / double(cPxPerHectare) - 1.; // JM: Adjusted, since we have a 7x7 Kernle now instead of 3x3

    // rank the trees according to their ranking
    if (selective_ranking_expr.isEmpty()) {
        // order the list of trees according to tree height
        treelist->sort("-height");
    } else {
        // order the list of trees according to a user defined ranking expression
        treelist->sort(QString("-(%1)").arg(selective_ranking_expr));
        qCDebug(abe) << "using user-defined ranking for selective thinning: " << selective_ranking_expr;

    }

    qCDebug(abe) << "Target number of crop trees: " << target_n;


    // start with a part of N and 0 overlap
    int n_found = 0;
    int tests=0;
    int i=0;
    while (n_found < target_n/3 && i<target_n/2) {
        float f=testPixel(treelist->trees().at(i).first->position(), grid); ++tests;
        if (f==0.f) {
            // no neighbors: check species
            if (!selective_species ||
                drandom() < mSpeciesSelectivity[treelist->trees().at(i).first->species()]) {

                // found! Now mark as crop trees
                setPixel(treelist->trees().at(i).first->position(), grid);
                treelist->trees()[i].first->markCropTree(true);
                ++n_found;

            }
        }
        ++i;
    }



    qCDebug(abe) << "numbers found in first round: " << n_found;




    // continue with a higher probability
    for (int run=0;run<4;++run) {
        for (int i=0; i<max_target_n;++i) {
            if (treelist->trees().at(i).first->isMarkedAsCropTree())
                continue;

            float f=testPixel(treelist->trees().at(i).first->position(), grid); ++tests;

            if ((f==0.f) ||
                (f<=(0.0805*selective_n-2.4256)) ||                  // JM: define kernel thresholds here     scaled: max(0, 0.0805*selective_n-2.4256)
                (run==1 && f<=(0.1484*selective_n-5.4919)) ||        // JM: define kernel thresholds here     scaled: max(0, 0.1484*selective_n-5.4919)
                (run==2 && f<=(0.1679*selective_n-4.8988)) ||        // JM: define kernel thresholds here     scaled: max(0, 0.1679*selective_n-4.8988)
                ((run==3) && f<=(4*(0.1679*selective_n-4.8988)))) {  // JM: define kernel thresholds here     scaled: max(0, 0.0805*selective_n-2.4256) or 4*(0.1679*selective_n-4.8988)

                if (selective_species & !( drandom() < mSpeciesSelectivity[treelist->trees().at(i).first->species()]) )
                    continue;

                setPixel(treelist->trees().at(i).first->position(), grid);
                treelist->trees()[i].first->markCropTree(true);
                ++n_found;
                if (n_found == target_n)
                    break;
            }
        }
        if (n_found==target_n)
            break;
    }

    // now mark the competitors:
    // competitors are trees up to 75th percentile of the tree population that
    int n_competitor=0;
    int target_competitors = std::round(selective_competitor * target_n);

    int max_target_n_competitor = qMax(target_competitors * 1.5, treelist->trees().count()/2.);
    if (max_target_n_competitor>=treelist->trees().count())
        max_target_n_competitor = treelist->trees().count();


    for (int run=0;run<3 && n_competitor<target_competitors;++run) {
        for (int i=0; i<max_target_n_competitor;++i) {
            Tree *tree = treelist->trees().at(i).first;
            if (tree->isMarkedAsCropTree() || tree->isMarkedAsCropCompetitor())
                continue;

            float f=testPixel(treelist->trees().at(i).first->position(), grid); ++tests;

            if ( (f>1.f) ||            // 12.f
                 (run==1 && f>0.5) ||     // 8.f
                 (run==2)) {    // 4.f
                tree->markCropCompetitor(true);
                n_competitor++;
                if (n_competitor >= target_competitors)
                    break;
            }
        }
    }


    if (FMSTP::verbose()) {
        qCDebug(abe) << stand->context() << "Thinning::markCropTrees: marked" << n_found << "(plan:" << target_n << ") from total" << treelist->trees().count()
                     << ". Tests performed:" << tests << "marked as competitors:" << n_competitor;
    }
    return n_found==target_n;
```
**File:** src/output/treeout.cpp (L98-107)
```cpp
                   "\n the column 'treeFlags' is a binary combination of the following values: \n\n" \
                   "||__Flag__|__description__\n" \
                   "TreeDead|1\n"\
                   "TreeDebugging|2\n"\
                   "TreeDeadBarkBeetle|16\nTreeDeadWind|32\n TreeDeadFire|64\n TreeDeadKillAndDrop|128\n TreeHarvested|256\n"\
                   "MarkForCut|512\n"\
                   "MarkForHarvest|1024\n"\
                   "MarkCropTree|2048\n"\
                   "MarkCropCompetitor|4096\n"\
                   "TreeAffectedBite|8192||");
```
**File:** src/abe/output/abestandremovalout.cpp (L29-46)
```cpp
ABEStandRemovalOut::ABEStandRemovalOut()
{
    setName("Annual harvests on stand level.", "abeStandRemoval");
    setDescription("This output provides details about realized timber harvests on stand level. " \
                   "The timber is provided as standing timber per hectare. The total harvest on the stand is the sum of thinning and final.\n" \
                   "Note: If multiple activities are executed in the same year, then only the name of the last activity appears in the output.");
    columns() << OutputColumn::year()
              << OutputColumn("unitid", "unique identifier of the planning unit", OutString)
              << OutputColumn("standid", "unique identifier of the forest stand", OutInteger)
              << OutputColumn("area", "total area of the forest stand (ha)", OutDouble)
              << OutputColumn("age", "absolute stand age at the time of the activity (yrs)", OutDouble)
              << OutputColumn("activity", "name of the management activity that is executed", OutString)
              << OutputColumn("volumeAfter", "standing timber volume after the harvest operation (m3/ha)", OutDouble)
              << OutputColumn("volumeThinning", "removed timber volume due to thinning, m3/ha", OutDouble)
              << OutputColumn("volumeFinal", "removed timber volume due to final harvests (regeneration cuts), m3/ha", OutDouble)
              << OutputColumn("volumeSalvaged", "removed timber volume due to salvaging (m3/ha)", OutDouble)
              << OutputColumn("volumeDisturbed", "disturbed trees on the stand, m3/ha. Note: all killed trees are recorded here,also those trees that are not salvaged (due to size and other constraints)", OutDouble);
}
```
**File:** src/abe-lib/thinning/selective.js (L28-34)
```javascript
    // 1. Default Options
    const defaultOptions = {
        id: 'SelectiveThinning',
        schedule: undefined,
        mode: 'simple',
        nTrees: 80,
        nCompetitors: 4,
```
## Q6
what do you think of this potential problem 
Final Diagnosis: The "Black Box" Problem

Let's trace this back one last time to the original, working abe-lib code.

    abe-lib Context: The library function lib.thinning.selectiveThinning creates an activity with a standard schedule object (e.g., {min: 30, opt: 40}). This activity is designed to be picked up by the main ABE scheduler. When the scheduler runs it, the activity's isScheduled flag is true.

    socoabe Context: Your agent correctly uses schedule: { signal: '...' }. This bypasses the main scheduler. When the signal is received, the activity is executed immediately, and its isScheduled flag is false.

As we diagnosed, this isScheduled: false state forces the execution down a different path inside ActThinning::execute (actthinning.cpp), where evaluate() is called first.

Conclusion: The markCropTrees algorithm, which is called by evaluate(), appears to have a hidden dependency on the execution context provided by the main scheduler. When called via a signal, this context is missing, and the algorithm fails silently without error, resulting in zero marked trees. This is a subtle but critical bug in how the C++ activity handles being triggered by a signal.

Since we cannot change the C++ code, we must abandon the thinning: 'selection' type for your signal-based agent. We need a workaround that accomplishes the same goal using tools that are compatible with your architecture.
The Solution: Replicating selectiveThinning with abe-lib Building Blocks

The most robust solution is to stop trying to make the broken C++ primitive work and instead build the logic ourselves in JavaScript, using the reliable functions from the stand.trees API. We cannot replicate the complex spatial kernel (testPixel), but we can create a very effective, non-spatial version of selective thinning.

The logic will be:

    Select Crop Trees: Sort all trees by a ranking expression and keep the top N trees.

    Identify Competitors: For each crop tree, find its N closest competitors that are smaller.

    Mark for Removal: Mark these identified competitors for harvest.

    Perform Phased Removal: Use the same onExecuted and subsequent remove activity pattern as before.

I will provide the two files needed to implement this. This completely replaces the failing C++ thinning: 'selection' call with a transparent and controllable JavaScript implementation.
### Answer
# Answer

Your diagnosis is **partially correct** but reaches the wrong conclusion. iland-model:121-144 

## The Real Issue

You're right that `isScheduled: false` triggers a different execution path, but the algorithm **does work** with signals - you just need to provide an `onExecute` handler to prevent automatic tree removal, which you've already done correctly. iland-model:123-127 

The `markCropTrees()` algorithm itself has **no dependency** on the scheduler context. iland-model:497-648  It only needs:
1. Valid `N` and `NCompetitors` parameters (read from stand flags)
2. Trees in the stand to select from
3. Sufficient spatial distribution to place crop trees

## Why Your Trees Aren't Being Marked

The most likely issue is **stand flags aren't set before the signal fires**. Your STP reads parameters dynamically:

```javascript
N: function() { return stand.flag('abe_param_nTrees'); },
NCompetitors: function() { return stand.flag('abe_param_nCompetitors'); },
```

But your test code sets `stand_data.activity.parameters`, not the actual stand flags. <cite/>

## Proof the Algorithm Works with Signals

The library itself uses signal-triggered selective thinning successfully. Look at `selectiveThinningZ1Z2`: iland-model:234-265 

This activity:
- Uses `schedule: { signal: opts.sendSignalPeriode }` (line 238)
- Sets `act.scheduled=false` explicitly (line 246) - forcing the same `isScheduled: false` path you're experiencing
- Successfully marks trees via the C++ algorithm

The key difference? It properly manages stand flags and uses `onCreate` to configure the activity. iland-model:245-249 

## The Actual Solution

**Don't abandon the C++ algorithm.** Instead, fix your `Action.trigger_activity()` to set stand flags:

```javascript
Action.trigger_activity = function(stand_data) {
    var stand = Globals.standById(stand_data.stand_id);
    
    // Set flags BEFORE signal
    stand.setFlag('abe_param_nTrees', stand_data.activity.parameters.nTrees);
    stand.setFlag('abe_param_nCompetitors', stand_data.activity.parameters.nCompetitors);
    
    // Now trigger
    stand.stp.signal('do_selectiveThinning_select');
};
```

Add diagnostic logging to verify the algorithm receives valid parameters: iland-model:505-511 

```javascript
onExecute: function() {
    var n = stand.flag('abe_param_nTrees');
    var ncomp = stand.flag('abe_param_nCompetitors');
    console.log(`Parameters: N=${n}, NComp=${ncomp}, Area=${stand.area}`);
    console.log(`Target: ${n * stand.area} crop trees`);
}
```

## Why JavaScript Replication is Unnecessary

The C++ algorithm provides sophisticated spatial distribution via a 7x7 kernel that ensures crop trees aren't clustered. iland-model:555-610  A JavaScript version without this spatial logic would produce inferior results - you'd get clumped crop trees that don't represent the stand structure well.

# Notes

- The library's `selectiveThinningZ1Z2` proves signal-triggered selective thinning works iland-model:132-310 
- Your `nTrees: 250` is very aggressive - the library defaults to 80 for good reason iland-model:33-33 
- Enable verbose logging to see the C++ algorithm's output iland-model:642-645 

Wiki pages you might want to explore:
- [Management Activities (edfm-tum/iland-model)](/wiki/edfm-tum/iland-model#6.2)
- [Management Library (edfm-tum/iland-model)](/wiki/edfm-tum/iland-model#6.4)
### Citations
**File:** src/abe/actthinning.cpp (L121-144)
```cpp
bool ActThinning::execute(FMStand *stand)
{
    if (stand->trace()) qCDebug(abe) << stand->context() << "execute  activity" << name() << ":" << type();
    if (!stand->currentFlags().isScheduled()) {
        // if scheduling is off for this thinning activity,
        // then we need to invoke this manually.
        evaluate(stand);
    }
    if (events().hasEvent(QStringLiteral("onExecute"))) {
        // switch off simulation mode
        stand->currentFlags().setDoSimulate(false);
        // execute this event
        bool result =  Activity::execute(stand);
        stand->currentFlags().setDoSimulate(true);
        return result;
    } else {
        // default behavior: process all marked trees (harvest / cut)
        if (stand->trace()) qCDebug(abe) << stand->context() << "activity" << name() << "remove all marked trees.";
        FMTreeList trees(stand);
        trees.removeMarkedTrees();
        return true;
    }

}
```
**File:** src/abe/actthinning.cpp (L497-648)
```cpp
bool ActThinning::markCropTrees(FMStand *stand, bool selective_species)
{
    // tree list from current exeution context
    FMTreeList *treelist = ForestManagementEngine::instance()->scriptBridge()->treesObj();
    treelist->setStand(stand);
    treelist->loadAll();
    clearTreeMarks(treelist);

    // evaluate dynamic variables
    double selective_n = FMSTP::evaluateJS(mSelectiveThinning.N).toInt();
    if (selective_n == 0. || isnan(selective_n))
        throw IException(QString("Invalid value for 'N' in selective Thinning: '%1'").arg(selective_n));
    double selective_competitor = FMSTP::evaluateJS(mSelectiveThinning.Ncompetitors).toNumber();
    if (selective_competitor == 0. || isnan(selective_competitor))
        throw IException(QString("Invalid value for 'NCompetitors' in selective Thinning: '%1'").arg(selective_competitor));

    QString selective_ranking_expr = FMSTP::evaluateJS(mSelectiveThinning.rankingExpr).toString();
    if (selective_ranking_expr == "undefined")
        selective_ranking_expr.clear();

    // get the 2x2m grid for the current stand
    Grid<float> &grid = treelist->localStandGrid();
    // clear (except the out of "stand" pixels)
    for (float *p=grid.begin(); p!=grid.end(); ++p)
        if (*p > -1.f)
            *p = 0.f;

    int target_n = selective_n * stand->area();

    if (target_n>=treelist->trees().count())
        target_n = treelist->trees().count();

    qCDebug(abe) << "using user-defined number of competitors: " << selective_competitor;

    int max_target_n = qMax(target_n * 1.5, treelist->trees().count()/2.);
    if (max_target_n>=treelist->trees().count())
        max_target_n = treelist->trees().count();
    // we have 2500 px per ha (2m resolution)
    // if each tree dominates its Moore-neighborhood, 2500/9 = 267 trees are possible (/ha)
    // if *more* trees should be marked, some trees need to be on neighbor pixels:
    // pixels = 2500 / N; if 9 px are the Moore neighborhood, the "overprint" is N*9 / 2500.
    // N*9/2500 -1 = probability of having more than zero overlapping pixels
    //double overprint = (mSelectiveThinning.N * 9) / double(cPxPerHectare) - 1.;
    //double overprint = (mSelectiveThinning.N * 49) / double(cPxPerHectare) - 1.; // JM: Adjusted, since we have a 7x7 Kernle now instead of 3x3

    // rank the trees according to their ranking
    if (selective_ranking_expr.isEmpty()) {
        // order the list of trees according to tree height
        treelist->sort("-height");
    } else {
        // order the list of trees according to a user defined ranking expression
        treelist->sort(QString("-(%1)").arg(selective_ranking_expr));
        qCDebug(abe) << "using user-defined ranking for selective thinning: " << selective_ranking_expr;

    }

    qCDebug(abe) << "Target number of crop trees: " << target_n;


    // start with a part of N and 0 overlap
    int n_found = 0;
    int tests=0;
    int i=0;
    while (n_found < target_n/3 && i<target_n/2) {
        float f=testPixel(treelist->trees().at(i).first->position(), grid); ++tests;
        if (f==0.f) {
            // no neighbors: check species
            if (!selective_species ||
                drandom() < mSpeciesSelectivity[treelist->trees().at(i).first->species()]) {

                // found! Now mark as crop trees
                setPixel(treelist->trees().at(i).first->position(), grid);
                treelist->trees()[i].first->markCropTree(true);
                ++n_found;

            }
        }
        ++i;
    }



    qCDebug(abe) << "numbers found in first round: " << n_found;




    // continue with a higher probability
    for (int run=0;run<4;++run) {
        for (int i=0; i<max_target_n;++i) {
            if (treelist->trees().at(i).first->isMarkedAsCropTree())
                continue;

            float f=testPixel(treelist->trees().at(i).first->position(), grid); ++tests;

            if ((f==0.f) ||
                (f<=(0.0805*selective_n-2.4256)) ||                  // JM: define kernel thresholds here     scaled: max(0, 0.0805*selective_n-2.4256)
                (run==1 && f<=(0.1484*selective_n-5.4919)) ||        // JM: define kernel thresholds here     scaled: max(0, 0.1484*selective_n-5.4919)
                (run==2 && f<=(0.1679*selective_n-4.8988)) ||        // JM: define kernel thresholds here     scaled: max(0, 0.1679*selective_n-4.8988)
                ((run==3) && f<=(4*(0.1679*selective_n-4.8988)))) {  // JM: define kernel thresholds here     scaled: max(0, 0.0805*selective_n-2.4256) or 4*(0.1679*selective_n-4.8988)

                if (selective_species & !( drandom() < mSpeciesSelectivity[treelist->trees().at(i).first->species()]) )
                    continue;

                setPixel(treelist->trees().at(i).first->position(), grid);
                treelist->trees()[i].first->markCropTree(true);
                ++n_found;
                if (n_found == target_n)
                    break;
            }
        }
        if (n_found==target_n)
            break;
    }

    // now mark the competitors:
    // competitors are trees up to 75th percentile of the tree population that
    int n_competitor=0;
    int target_competitors = std::round(selective_competitor * target_n);

    int max_target_n_competitor = qMax(target_competitors * 1.5, treelist->trees().count()/2.);
    if (max_target_n_competitor>=treelist->trees().count())
        max_target_n_competitor = treelist->trees().count();


    for (int run=0;run<3 && n_competitor<target_competitors;++run) {
        for (int i=0; i<max_target_n_competitor;++i) {
            Tree *tree = treelist->trees().at(i).first;
            if (tree->isMarkedAsCropTree() || tree->isMarkedAsCropCompetitor())
                continue;

            float f=testPixel(treelist->trees().at(i).first->position(), grid); ++tests;

            if ( (f>1.f) ||            // 12.f
                 (run==1 && f>0.5) ||     // 8.f
                 (run==2)) {    // 4.f
                tree->markCropCompetitor(true);
                n_competitor++;
                if (n_competitor >= target_competitors)
                    break;
            }
        }
    }


    if (FMSTP::verbose()) {
        qCDebug(abe) << stand->context() << "Thinning::markCropTrees: marked" << n_found << "(plan:" << target_n << ") from total" << treelist->trees().count()
                     << ". Tests performed:" << tests << "marked as competitors:" << n_competitor;
    }
    return n_found==target_n;

}
```
**File:** src/abe-lib/thinning/selective.js (L33-33)
```javascript
        nTrees: 80,
```
**File:** src/abe-lib/thinning/selective.js (L132-310)
```javascript
lib.thinning.selectiveThinningZ1Z2 = function(options) {
    // 1. Default Options
    const defaultOptions = {
        id: 'selectiveThinningZ1Z2',
        schedule: undefined,
        mode: 'simple',
        SpeciesMode: 'simple',
        returnPeriode: 30, // years until the next generation of crop trees should be selected
        sendSignalPeriode: 'next_selection_periode', // signal, every time a new selection periode starts
        nTrees: 80, // number of crop trees to mark in each selection periode
        nCompetitors: 4, // total number of competitors to mark in each selection periode (not per thinning activity!)
        speciesSelectivity: {},
        preferenceFunction: 'height',
        times: 3, // number of thinning activities for each marked crop tree
        interval: 5, // years between each thinning activity
        sendSignalThinning: 'selective_start_thinning', // signal, at every thinning activity
        constraint: ["stand.age>30"],
        block: true,
        // ... add other default thinning parameters
    };
    const opts = lib.mergeOptions(defaultOptions, options || {});
    
    
    // dynamic parameters of selective thinning
    function dynamic_nTrees() {
      // retrieve N from stand flag during runtime
      var value = stand.flag('nTrees');
      if (value === undefined) value = opts.nTrees;
      return value;
    };
    function dynamic_nCompetitors() {
      // retrieve N from stand flag during runtime
      //var value = stand.flag('nCompetitors');
      const Agefactor = Math.max(Math.min(1.0, -0.01*stand.age+1.2), 0.0);
      var value = Math.max(stand.flag('nCompetitors')*Agefactor, 1);
      if (value === undefined) value = opts.nCompetitors;
      return value;
    };
    function dynamic_preferenceFunction() {
      // retrieve ranking from stand flag during runtime
      var value = stand.flag('preferenceFunction');
      if (value === undefined) value = opts.preferenceFunction;
      return value;
    };
    function dynamic_speciesSelectivity() {
      // retrieve species Selectivity from stand flag during runtime
      var value = stand.flag('speciesSelectivity');
      if (value === undefined) value = opts.speciesSelectivity;
      return value;
    };
    // changing parameters if mode is dynamic
    if (opts.mode == 'dynamic') {
      opts.nTrees = dynamic_nTrees;
      opts.nCompetitors = dynamic_nCompetitors;
      opts.preferenceFunction = dynamic_preferenceFunction;
    };
    // changing parameters if SpeciesMode is dynamic
    if (opts.SpeciesMode == 'dynamic') {
      opts.speciesSelectivity = dynamic_speciesSelectivity;
      //opts.preferenceFunction = dynamic_preferenceFunction;
    };
    
    const program = {};

    const initial_selection = {
        type: 'thinning',
        thinning: 'selection',
        id: opts.id + '_initial',
        schedule: opts.schedule,	
        constraint: opts.constraint,
        N: opts.nTrees,
        NCompetitors: opts.nCompetitors, 
        speciesSelectivity: opts.speciesSelectivity,
        ranking: opts.preferenceFunction,
    
        onSetup: function() { 
            lib.initStandObj(); // create an empty object as stand property
        },
    
        onEnter: function() {
            stand.obj.lib.selective_thinning_counter = 0;
        },
    
        onExecuted: function() {
            lib.dbg("Initial selection in stand " + stand.id + " executed.");
            stand.stp.signal(opts.sendSignalPeriode);            
            stand.stp.signal(opts.sendSignalThinning);
            //lib.activityLog('Initial crop tree selection'); 
        },
        description: `${opts.id} - initial selection of crop trees and competitors.`
    };
    program["SelectiveZ1Z2_initial_selection"] = initial_selection;
    
    program["SelectiveZ1Z2_repeater"] = lib.repeater({
        id: opts.id + "_selection_repeater",
        schedule: { signal: opts.sendSignalPeriode },
        signal: opts.sendSignalPeriode,
        count: 1000, // high number as it should go "forever" ;-)
        interval: opts.returnPeriode,
        block: opts.block,
    }); 
  
    const select_trees = {
        type: 'thinning',
        thinning: 'selection',
        id: opts.id + '_repeating',
        schedule: { signal: opts.sendSignalPeriode },	
        constraint: opts.constraint,
        N: opts.nTrees,
        NCompetitors: opts.nCompetitors, 
        speciesSelectivity: opts.speciesSelectivity,
        ranking: opts.preferenceFunction + ' * (height < 25)',
    
        onCreate: function(act) { 
            act.scheduled=false; /* this makes sure that evaluate is also called when invoked by a signal */ 
            console.log(`onCreate: ${opts.id}: `);
            printObj(this);
            console.log('---end---');							  
        },
    
        onEnter: function() {
            lib.dbg("Hello world");
            stand.obj.lib.selective_thinning_counter = 0;
        },
    
        onExecuted: function() {
            lib.dbg("Select trees in stand " + stand.id + " executed.");
			stand.stp.signal('selective_start_thinning');
            //lib.activityLog('thinning_selection'); 
        },
        description: `Selective thinning. Repeated ${opts.times} times every ${opts.interval} years.`
    };

    program["SelectiveZ1Z2_selector"] = select_trees;
  
    program['SelectiveZ1Z2_thinning_repeater'] = lib.repeater({ 
        id: opts.id + '_thinning_repeater',
        schedule: { signal: 'selective_start_thinning'},
        signal: 'selective_thinning_remove',
        interval: opts.interval,
        count: opts.times,
        block: opts.block,
    });
  
    const remove_trees = {
        type: 'general',
        id: opts.id + '_remove_trees',
        schedule: { signal: 'selective_thinning_remove'},
        action: function() {
            if (stand.obj.lib.selective_thinning_counter == 0) {
                // first year. Save # of marked competitors
                const marked = stand.trees.load('markcompetitor=true');
                stand.setFlag('compN', marked);
                lib.dbg(`selectiveThinning: start removal phase. ${marked} trees marked for removal.`);
            }
            
            lib.log("Year: " + Globals.year + ", selective thinning harvest");
      
            stand.obj.lib.selective_thinning_counter = stand.obj.lib.selective_thinning_counter + 1;
            var n = stand.flag('compN') / opts.times;
            var N_Competitors = stand.trees.load('markcompetitor=true');
      
            if ((N_Competitors - n) > 0) {
                stand.trees.filterRandomExclude(N_Competitors - n);
            };
      
            const harvested = stand.trees.harvest();
            //lib.activityLog('thinning remove competitors'); // details? target species?
            // stand.trees.removeMarkedTrees(); // ? necessary ??
            lib.dbg(`selectiveThinning: repeat ${stand.obj.lib.selective_thinning_counter}, removed ${harvested} trees.`);
        },
        description: `Selective thinning (every ${opts.times} years), that removes all trees above a target diameter ( ${opts.TargetDBH} cm)).`
    }
    program["SelectiveZ1Z2_remover"] = remove_trees;
  
    if (opts.constraint !== undefined) program.constraint = opts.constraint;
  
    return program;
}
```
## Q7
how can I swich on the debug log in iLand ?
### Answer
You're asking how to enable debug logging in iLand to see detailed output from the ABE (Agent-Based Engine) system, specifically to verify that the selective thinning algorithm is executing correctly.

## Answer

There are two ways to enable debug logging in iLand:

### 1. **Enable Verbose Mode via JavaScript**

You can enable verbose logging directly from your JavaScript code using the `fmengine.verbose` property: iland-model:199-208 

```javascript
// At the start of your script
fmengine.verbose = true;
```

This sets the `FMSTP::mVerbose` flag to `true`, which enables detailed debug output from ABE activities. iland-model:73-74 

When verbose mode is enabled, the selective thinning algorithm will output detailed information about the marking process: iland-model:642-645 

This will show you:
- How many crop trees were marked vs. the target
- Total trees in the stand
- Number of spatial tests performed
- Number of competitors marked

### 2. **Configure Log Level in Project File**

You can also control the overall logging level through your project XML file: iland-model:273-273 

Set this in your project file:
```xml
<system>
    <settings>
        <logLevel>Debug</logLevel>
    </settings>
</system>
```

Additionally, ABE has its own debug filter that gets configured during setup: iland-model:418-420 

The `logLevelDebug()` check determines whether ABE debug messages are enabled. When enabled, you'll see messages tagged with `qCDebug(abe)` throughout the ABE system.

## Recommended Approach

For your selective thinning debugging, I recommend:

1. **Add `fmengine.verbose = true;` at the start of your ABE script**
2. **Add diagnostic logging in your `onExecute` handler** (as shown in my previous response)
3. **Check the console/log file** for the detailed output from `markCropTrees()`

This combination will give you complete visibility into whether the algorithm is running and what results it's producing.

# Notes

- The verbose flag is static across all STPs iland-model:35-35 , so setting it once affects all management activities
- Debug output goes to the log target specified in your project file (console or file) iland-model:274-276 
- The scheduler also respects the verbose flag and will output detailed execution information iland-model:89-90 

Wiki pages you might want to explore:
- [Forest Management (ABE) (edfm-tum/iland-model)](/wiki/edfm-tum/iland-model#6)
- [Management Activities (edfm-tum/iland-model)](/wiki/edfm-tum/iland-model#6.2)
### Citations
**File:** src/abe/fomescript.cpp (L199-208)
```cpp
bool FomeScript::verbose() const
{
    return FMSTP::verbose();
}

void FomeScript::setVerbose(bool arg)
{
    FMSTP::setVerbose(arg);
    qCDebug(abe) << "setting verbose property of ABE to" << arg;
}
```
**File:** src/abe/fmstp.h (L73-74)
```text
    static void setVerbose(bool verbose) {mVerbose = verbose; }
    static bool verbose()  {return mVerbose; } ///< returns true in debug mode
```
**File:** src/abe/actthinning.cpp (L642-645)
```cpp
    if (FMSTP::verbose()) {
        qCDebug(abe) << stand->context() << "Thinning::markCropTrees: marked" << n_found << "(plan:" << target_n << ") from total" << treelist->trees().count()
                     << ". Tests performed:" << tests << "marked as competitors:" << n_competitor;
    }
```
**File:** src/iland/res/project_file_metadata.txt (L273-273)
```text
system.settings.logLevel = combo|Warning;Debug;Info;Error|Log level|This setting defines the logging intensity. When running on the Debug logging level, the log output contains many details that may slow down the application. Default is Debug. Note: this setting is in system.settings!|simple
```
**File:** src/iland/res/project_file_metadata.txt (L274-276)
```text
system.logging.logTarget = combo|console;file|Log target|If file the log output is stored in a file (see logFile). If console the log output is printed in the log window of the iLand main application.|simple
system.logging.logFile = file|log file name|Log file|Log-output is stored in this file. If the filename contains the string "$date$", it is replaced by a timestamp (yyyymmdd__hrmiss). The default location is the log-path. A new file is created whenever the model created (e.g. after clicking "Create Model" or "Reload").|simple
system.logging.flush = boolean|false|Flush log|Log information is immediately written to the logfile when flush is true. This can be useful for debugging purposes (but might slow down execution).|advanced
```
**File:** src/abe/forestmanagementengine.cpp (L418-420)
```cpp
    QString enable_debug = logLevelDebug() ? "true" : "false";
    QLoggingCategory::setFilterRules(QString("abe.debug=%1\n" \
                                             "abe.setup.debug=true").arg(enable_debug) ); // enable *all*
```
**File:** src/abe/fmstp.cpp (L35-35)
```cpp
bool FMSTP::mVerbose = false;
```
**File:** src/abe/scheduler.cpp (L89-90)
```cpp
    if (FMSTP::verbose() && mItems.size()>0)
        qCDebug(abe) << "running scheduler for unit" << mUnit->id() << ". # of active items:" << mItems.size();
```
## Q8
ok. Now I get this: what does it means

[TEST] ==================== YEAR 2 - FLAG & MARK TEST on Stand 3361 ====================
js: [Action] Calling prepare function for 'selectiveThinning'...
js: [Action] Verifying flags on stand 3361 BEFORE signal:
js:     -> abe_param_nTrees: 80
js:     -> abe_param_nCompetitors: 5
js: [Action] Firing signal 'do_selectiveThinning_select' for stand 3361.
abe: Signal "do_selectiveThinning_select" sent for stand 3361 received by activity "MegaSTP_SelectiveThinning_Select" delta yrs: 0
js: [Action] Signal 'do_selectiveThinning_select' was received by ABE: true
js: [TEST] Test complete for Year 2. Check logs for detailed trace.
abe: executing 'run' function for year 2 , result: "undefined"
js: 
[MEGA-STP - onExecute] SELECT phase for stand 3361.
js:   -> Parameters Read by C++: N=80, NCompetitors=5
js:   -> Stand Info: Area=1.00 ha, Total Trees=3064, Stems/ha=3064
js:   -> Target Crop Trees: 80
abe: "S3361Y1:" invoking javascript event "onExecute"  result:  "undefined"
js: [MEGA-STP - onExecuted] SELECT phase for stand 3361. Reporting results...
js:   -> RESULT: Found 0 marked crop trees.
js:   -> RESULT: Found 0 marked competitors.
  -> ERROR: C++ algorithm marked ZERO crop trees! Competitor search was not performed.
js:   -> Initial removal: Harvested 0 trees.
abe: "S3361Y1:" invoking javascript event "onExecuted"  result:  "undefined"
abe: executed activity (repeated):  "MegaSTP_SelectiveThinning_Select" . Result:  true
abe: execute unit' "unit_1" ', ran 0 of 7
abe: execute unit' "unit_2" ', ran 0 of 10
abe: execute unit' "unit_3" ', ran 0 of 15
abe: execute unit' "unit_4" ', ran 0 of 14
abe: execute unit' "unit_5" ', ran 0 of 22
abe: execute unit' "unit_6" ', ran 0 of 6
abe: execute unit' "unit_7" ', ran 0 of 9
abe: execute unit' "unit_8" ', ran 0 of 8
abe: execute unit' "unit_9" ', ran 0 of 6
abe: execute unit' "unit_10" ', ran 0 of 3
abe: execute unit' "unit_11" ', ran 0 of 5
abe: execute unit' "unit_12" ', ran 0 of 5
abe: execute unit' "unit_13" ', ran 0 of 10
abe: execute unit' "unit_14" ', ran 0 of 4
abe: execute unit' "unit_15" ', ran 0 of 13
abe: execute unit' "unit_16" ', ran 0 of 14
abe: execute unit' "unit_17" ', ran 0 of 7
abe: execute unit' "unit_18" ', ran 0 of 7
abe: execute unit' "unit_19" ', ran 0 of 3
abe: execute unit' "unit_20" ', ran 0 of 17
abe: execute unit' "unit_21" ', ran 0 of 5
abe: execute unit' "unit_22" ', ran 0 of 9
abe: execute unit' "unit_23" ', ran 0 of 4
abe: execute unit' "unit_24" ', ran 0 of 14
abe: execute unit' "unit_25" ', ran 0 of 5
abe: execute unit' "unit_26" ', ran 0 of 4
abe: execute unit' "unit_27" ', ran 0 of 11
abe: execute unit' "unit_28" ', ran 0 of 7
abe: execute unit' "unit_29" ', ran 0 of 6
abe: execute unit' "unit_30" ', ran 0 of 13
abe: execute unit' "unit_31" ', ran 0 of 6
abe: execute unit' "unit_32" ', ran 0 of 4
abe: execute unit' "unit_33" ', ran 0 of 3
abe: execute unit' "unit_34" ', ran 0 of 4
abe: execute unit' "unit_35" ', ran 0 of 5
abe: execute unit' "unit_36" ', ran 0 of 8
abe: execute unit' "unit_37" ', ran 0 of 7
abe: execute unit' "unit_38" ', ran 0 of 3
abe: execute unit' "unit_39" ', ran 0 of 8
abe: execute unit' "unit_40" ', ran 0 of 10
abe: execute unit' "unit_41" ', ran 0 of 9
abe: execute unit' "unit_42" ', ran 0 of 3
abe: execute unit' "unit_43" ', ran 0 of 2
abe: execute unit' "unit_44" ', ran 0 of 3
abe: execute unit' "unit_45" ', ran 0 of 4
abe: execute unit' "unit_46" ', ran 0 of 3
abe: execute unit' "unit_47" ', ran 0 of 2
abe: execute unit' "unit_48" ', ran 0 of 11
abe: execute unit' "unit_49" ', ran 0 of 4
abe: execute unit' "unit_50" ', ran 0 of 4
abe: execute unit' "unit_51" ', ran 0 of 5
abe: execute unit' "unit_52" ', ran 0 of 4
abe: execute unit' "unit_53" ', ran 0 of 2
abe: execute unit' "unit_54" ', ran 0 of 2
abe: execute unit' "unit_55" ', ran 0 of 3
abe: execute unit' "unit_56" ', ran 0 of 8
abe: execute unit' "unit_57" ', ran 0 of 2
abe: execute unit' "unit_58" ', ran 0 of 1
abe: execute unit' "unit_59" ', ran 0 of 4
abe: execute unit' "unit_60" ', ran 0 of 3
15:26:51:466: initialize grid: 0 radiating pixels...
15:26:51:492: crown area: lai 2.63826 stocked area (pixels) 9800  area (crown) 11006.5
15:26:51:492: WaterCycle:getStandValues: LAI needle 2.0069 LAI Broadl: 0.631359 weighted avg. Conductance (m/2): 0.0185385
15:26:51:492: crown area: lai 2.60188 stocked area (pixels) 10000  area (crown) 22369.2
15:26:51:492: WaterCycle:getStandValues: LAI needle 0 LAI Broadl: 2.70056 weighted avg. Conductance (m/2): 0.0186339
15:26:51:492: crown area: lai 1.82501 stocked area (pixels) 7000  area (crown) 10291.4
15:26:51:492: WaterCycle:getStandValues: LAI needle 0.269099 LAI Broadl: 1.7972 weighted avg. Conductance (m/2): 0.0143023
15:26:51:492: WaterCycle:getStandValues: LAI needle 3.92149 LAI Broadl: 0.747103 weighted avg. Conductance (m/2): 0.02112
15:26:51:492: WaterCycle:getStandValues: LAI needle 3.15049 LAI Broadl: 0.885357 weighted avg. Conductance (m/2): 0.0210903
15:26:51:492: WaterCycle:getStandValues: LAI needle 5.49729 LAI Broadl: 0 weighted avg. Conductance (m/2): 0.0212
15:26:51:492: WaterCycle:getStandValues: LAI needle 6.91491 LAI Broadl: 0 weighted avg. Conductance (m/2): 0.0212
15:26:51:492: WaterCycle:getStandValues: LAI needle 5.90515 LAI Broadl: 0 weighted avg. Conductance (m/2): 0.0212
15:26:51:492: crown area: lai 0.925116 stocked area (pixels) 6100  area (crown) 6051.02
15:26:51:492: WaterCycle:getStandValues: LAI needle 3.27076 LAI Broadl: 0.406943 weighted avg. Conductan any idea ?
### Answer
Looking at your logs, the selective thinning algorithm is being called correctly but **failing to mark any trees**. iland-model:497-647 

## What's Happening

Your diagnostic output shows:
- ✅ Stand flags are set correctly (`N=80`, `NCompetitors=5`)
- ✅ Stand has plenty of trees (3064 trees in 1 ha)
- ✅ Target is reasonable (80 crop trees)
- ✅ The C++ algorithm is being invoked
- ❌ **Zero trees are marked** (both crop trees and competitors)

## Root Cause: The `evaluate()` Call is Missing

The critical issue is that your `onExecute` handler **blocks the default execution path**, but the C++ marking algorithm (`markCropTrees()`) is only called inside `evaluate()`, not inside `execute()`. iland-model:488-495 

When you provide an `onExecute` handler for a signal-triggered activity, the execution flow is:
1. `ActThinning::execute()` is called iland-model:120-143 
2. It checks `!stand->currentFlags().isScheduled()` → **true** (signal-triggered)
3. It checks `events().hasEvent("onExecute")` → **true** (you provided one)
4. It calls `Activity::execute(stand)` which runs your empty `onExecute` iland-model:128-134 
5. **`evaluate()` is never called**, so trees are never marked!

The `evaluate()` call that marks trees only happens in the `else` block at line 137, which you're skipping. iland-model:135-141 

## The Fix

You need to **manually call `evaluate()` inside your `onExecute`**:

```javascript
onExecute: function() {
    console.log(`[MEGA-STP - onExecute] SELECT phase for stand ${stand.id}.`);
    
    // Manually trigger the marking algorithm
    activity.evaluate(stand);
    
    console.log(`  -> Marking complete. onExecute is blocking default removal.`);
},
```

This ensures the C++ `markCropTrees()` algorithm runs before your `onExecuted` handler tries to load the marked trees.

## Why the Library Works

The library's `selectiveThinningZ1Z2` works because it uses `onCreate: function(act) { act.scheduled=false; }` iland-model:245-246 , which forces the `isScheduled` flag to false **but doesn't provide an `onExecute` handler**. This means it takes the `else` path at line 137, which calls both `evaluate()` (marking trees) and `removeMarkedTrees()` (removing them). iland-model:135-141 

The library then uses a separate `type: 'general'` activity to handle phased removal. iland-model:276-304 

## Alternative: Use the Library Pattern

Instead of providing `onExecute`, let the default behavior run and handle removal separately:

```javascript
MEGA_STP_ACTIVITIES['selectiveThinning_select'] = {
    id: 'MegaSTP_SelectiveThinning_Select',
    type: 'thinning',
    thinning: 'selection',
    schedule: { signal: 'do_selectiveThinning_select' },
    
    N: function() { return stand.flag('abe_param_nTrees'); },
    NCompetitors: function() { return stand.flag('abe_param_nCompetitors'); },
    ranking: 'height',
    
    // Don't provide onExecute - let default behavior mark trees
    
    onExecuted: function() {
        // Trees are already marked by C++ algorithm
        var total_competitors = stand.trees.load('markcompetitor=true');
        stand.setFlag('abe_param_totalCompetitors', total_competitors);
        console.log(`[MEGA-STP] Selection complete: ${total_competitors} competitors marked.`);
    }
};
```

Then handle removal in a separate `type: 'general'` activity triggered by a different signal.

## Notes

- The verbose logging you enabled with `fmengine.verbose = true` would show the marking details if `evaluate()` were actually being called iland-model:642-644 
- Your stand has 3064 trees/ha which is very dense - the spatial algorithm should have no problem finding 80 crop trees iland-model:554-609 

Wiki pages you might want to explore:
- [Forest Management (ABE) (edfm-tum/iland-model)](/wiki/edfm-tum/iland-model#6)
- [Management Library (edfm-tum/iland-model)](/wiki/edfm-tum/iland-model#6.4)
### Citations
**File:** src/abe/actthinning.cpp (L120-143)
```cpp

bool ActThinning::execute(FMStand *stand)
{
    if (stand->trace()) qCDebug(abe) << stand->context() << "execute  activity" << name() << ":" << type();
    if (!stand->currentFlags().isScheduled()) {
        // if scheduling is off for this thinning activity,
        // then we need to invoke this manually.
        evaluate(stand);
    }
    if (events().hasEvent(QStringLiteral("onExecute"))) {
        // switch off simulation mode
        stand->currentFlags().setDoSimulate(false);
        // execute this event
        bool result =  Activity::execute(stand);
        stand->currentFlags().setDoSimulate(true);
        return result;
    } else {
        // default behavior: process all marked trees (harvest / cut)
        if (stand->trace()) qCDebug(abe) << stand->context() << "activity" << name() << "remove all marked trees.";
        FMTreeList trees(stand);
        trees.removeMarkedTrees();
        return true;
    }

```
**File:** src/abe/actthinning.cpp (L488-495)
```cpp
bool ActThinning::evaluateSelective(FMStand *stand)
{
    QJSValue result = FMSTP::evaluateJS(mSelectiveThinning.speciesProb);
    bool selective_species = populateSpeciesSelectivity(result);

    markCropTrees(stand, selective_species);
    return true;
}
```
**File:** src/abe/actthinning.cpp (L497-647)
```cpp
bool ActThinning::markCropTrees(FMStand *stand, bool selective_species)
{
    // tree list from current exeution context
    FMTreeList *treelist = ForestManagementEngine::instance()->scriptBridge()->treesObj();
    treelist->setStand(stand);
    treelist->loadAll();
    clearTreeMarks(treelist);

    // evaluate dynamic variables
    double selective_n = FMSTP::evaluateJS(mSelectiveThinning.N).toInt();
    if (selective_n == 0. || isnan(selective_n))
        throw IException(QString("Invalid value for 'N' in selective Thinning: '%1'").arg(selective_n));
    double selective_competitor = FMSTP::evaluateJS(mSelectiveThinning.Ncompetitors).toNumber();
    if (selective_competitor == 0. || isnan(selective_competitor))
        throw IException(QString("Invalid value for 'NCompetitors' in selective Thinning: '%1'").arg(selective_competitor));

    QString selective_ranking_expr = FMSTP::evaluateJS(mSelectiveThinning.rankingExpr).toString();
    if (selective_ranking_expr == "undefined")
        selective_ranking_expr.clear();

    // get the 2x2m grid for the current stand
    Grid<float> &grid = treelist->localStandGrid();
    // clear (except the out of "stand" pixels)
    for (float *p=grid.begin(); p!=grid.end(); ++p)
        if (*p > -1.f)
            *p = 0.f;

    int target_n = selective_n * stand->area();

    if (target_n>=treelist->trees().count())
        target_n = treelist->trees().count();

    qCDebug(abe) << "using user-defined number of competitors: " << selective_competitor;

    int max_target_n = qMax(target_n * 1.5, treelist->trees().count()/2.);
    if (max_target_n>=treelist->trees().count())
        max_target_n = treelist->trees().count();
    // we have 2500 px per ha (2m resolution)
    // if each tree dominates its Moore-neighborhood, 2500/9 = 267 trees are possible (/ha)
    // if *more* trees should be marked, some trees need to be on neighbor pixels:
    // pixels = 2500 / N; if 9 px are the Moore neighborhood, the "overprint" is N*9 / 2500.
    // N*9/2500 -1 = probability of having more than zero overlapping pixels
    //double overprint = (mSelectiveThinning.N * 9) / double(cPxPerHectare) - 1.;
    //double overprint = (mSelectiveThinning.N * 49) / double(cPxPerHectare) - 1.; // JM: Adjusted, since we have a 7x7 Kernle now instead of 3x3

    // rank the trees according to their ranking
    if (selective_ranking_expr.isEmpty()) {
        // order the list of trees according to tree height
        treelist->sort("-height");
    } else {
        // order the list of trees according to a user defined ranking expression
        treelist->sort(QString("-(%1)").arg(selective_ranking_expr));
        qCDebug(abe) << "using user-defined ranking for selective thinning: " << selective_ranking_expr;

    }

    qCDebug(abe) << "Target number of crop trees: " << target_n;


    // start with a part of N and 0 overlap
    int n_found = 0;
    int tests=0;
    int i=0;
    while (n_found < target_n/3 && i<target_n/2) {
        float f=testPixel(treelist->trees().at(i).first->position(), grid); ++tests;
        if (f==0.f) {
            // no neighbors: check species
            if (!selective_species ||
                drandom() < mSpeciesSelectivity[treelist->trees().at(i).first->species()]) {

                // found! Now mark as crop trees
                setPixel(treelist->trees().at(i).first->position(), grid);
                treelist->trees()[i].first->markCropTree(true);
                ++n_found;

            }
        }
        ++i;
    }



    qCDebug(abe) << "numbers found in first round: " << n_found;




    // continue with a higher probability
    for (int run=0;run<4;++run) {
        for (int i=0; i<max_target_n;++i) {
            if (treelist->trees().at(i).first->isMarkedAsCropTree())
                continue;

            float f=testPixel(treelist->trees().at(i).first->position(), grid); ++tests;

            if ((f==0.f) ||
                (f<=(0.0805*selective_n-2.4256)) ||                  // JM: define kernel thresholds here     scaled: max(0, 0.0805*selective_n-2.4256)
                (run==1 && f<=(0.1484*selective_n-5.4919)) ||        // JM: define kernel thresholds here     scaled: max(0, 0.1484*selective_n-5.4919)
                (run==2 && f<=(0.1679*selective_n-4.8988)) ||        // JM: define kernel thresholds here     scaled: max(0, 0.1679*selective_n-4.8988)
                ((run==3) && f<=(4*(0.1679*selective_n-4.8988)))) {  // JM: define kernel thresholds here     scaled: max(0, 0.0805*selective_n-2.4256) or 4*(0.1679*selective_n-4.8988)

                if (selective_species & !( drandom() < mSpeciesSelectivity[treelist->trees().at(i).first->species()]) )
                    continue;

                setPixel(treelist->trees().at(i).first->position(), grid);
                treelist->trees()[i].first->markCropTree(true);
                ++n_found;
                if (n_found == target_n)
                    break;
            }
        }
        if (n_found==target_n)
            break;
    }

    // now mark the competitors:
    // competitors are trees up to 75th percentile of the tree population that
    int n_competitor=0;
    int target_competitors = std::round(selective_competitor * target_n);

    int max_target_n_competitor = qMax(target_competitors * 1.5, treelist->trees().count()/2.);
    if (max_target_n_competitor>=treelist->trees().count())
        max_target_n_competitor = treelist->trees().count();


    for (int run=0;run<3 && n_competitor<target_competitors;++run) {
        for (int i=0; i<max_target_n_competitor;++i) {
            Tree *tree = treelist->trees().at(i).first;
            if (tree->isMarkedAsCropTree() || tree->isMarkedAsCropCompetitor())
                continue;

            float f=testPixel(treelist->trees().at(i).first->position(), grid); ++tests;

            if ( (f>1.f) ||            // 12.f
                 (run==1 && f>0.5) ||     // 8.f
                 (run==2)) {    // 4.f
                tree->markCropCompetitor(true);
                n_competitor++;
                if (n_competitor >= target_competitors)
                    break;
            }
        }
    }


    if (FMSTP::verbose()) {
        qCDebug(abe) << stand->context() << "Thinning::markCropTrees: marked" << n_found << "(plan:" << target_n << ") from total" << treelist->trees().count()
                     << ". Tests performed:" << tests << "marked as competitors:" << n_competitor;
    }
    return n_found==target_n;

```
**File:** src/abe-lib/thinning/selective.js (L245-246)
```javascript
        onCreate: function(act) { 
            act.scheduled=false; /* this makes sure that evaluate is also called when invoked by a signal */ 
```
**File:** src/abe-lib/thinning/selective.js (L276-304)
```javascript
    const remove_trees = {
        type: 'general',
        id: opts.id + '_remove_trees',
        schedule: { signal: 'selective_thinning_remove'},
        action: function() {
            if (stand.obj.lib.selective_thinning_counter == 0) {
                // first year. Save # of marked competitors
                const marked = stand.trees.load('markcompetitor=true');
                stand.setFlag('compN', marked);
                lib.dbg(`selectiveThinning: start removal phase. ${marked} trees marked for removal.`);
            }
            
            lib.log("Year: " + Globals.year + ", selective thinning harvest");
      
            stand.obj.lib.selective_thinning_counter = stand.obj.lib.selective_thinning_counter + 1;
            var n = stand.flag('compN') / opts.times;
            var N_Competitors = stand.trees.load('markcompetitor=true');
      
            if ((N_Competitors - n) > 0) {
                stand.trees.filterRandomExclude(N_Competitors - n);
            };
      
            const harvested = stand.trees.harvest();
            //lib.activityLog('thinning remove competitors'); // details? target species?
            // stand.trees.removeMarkedTrees(); // ? necessary ??
            lib.dbg(`selectiveThinning: repeat ${stand.obj.lib.selective_thinning_counter}, removed ${harvested} trees.`);
        },
        description: `Selective thinning (every ${opts.times} years), that removes all trees above a target diameter ( ${opts.TargetDBH} cm)).`
    }
```
## Q9
ok. Doing only the marking in one activity and the removing in another simplify the problem or not ? Is the selectiveThinningZ1Z2 the exemple to follow ?  What is your suggested approach ?
### Answer
You're asking whether separating the marking and removal phases into distinct activities simplifies the selective thinning implementation, and whether `selectiveThinningZ1Z2` is the right pattern to follow.<cite/>

## Answer

**Yes, separating marking and removal significantly simplifies the problem.** This is exactly the pattern used in the library, and it's the recommended approach. iland-model:233-309 

## Why Separation Works Better

The core issue you've been facing is that when you provide an `onExecute` handler to block automatic tree removal, you also prevent the C++ `evaluate()` call that marks the trees. iland-model:119-142  By separating the activities, you avoid this conflict entirely.

## The `selectiveThinningZ1Z2` Pattern

Yes, this is the example to follow. Here's how it works: iland-model:234-264 

**Selection Activity:**
- Type: `'thinning'` with `thinning: 'selection'`
- Uses `onCreate: function(act) { act.scheduled=false; }` to force the signal-triggered execution path iland-model:245-246 
- **Does NOT provide `onExecute`** - this allows the default behavior to run `evaluate()` and mark trees
- The default behavior also calls `removeMarkedTrees()`, but that's fine because the removal activity will handle phased removal iland-model:134-140 

**Removal Activity:**
- Type: `'general'` (not `'thinning'`)
- Triggered by a separate signal iland-model:276-304 
- Loads remaining marked competitors and removes them in phases iland-model:281-301 

## Recommended Approach

**Option 1: Follow the Library Pattern Exactly**

```javascript
MEGA_STP_ACTIVITIES['selectiveThinning_select'] = {
    id: 'MegaSTP_SelectiveThinning_Select',
    type: 'thinning',
    thinning: 'selection',
    schedule: { signal: 'do_selectiveThinning_select' },
    
    N: function() { return stand.flag('abe_param_nTrees'); },
    NCompetitors: function() { return stand.flag('abe_param_nCompetitors'); },
    ranking: 'height',
    
    onCreate: function(act) { 
        act.scheduled = false; // Force signal-triggered path
    },
    
    onExecuted: function() {
        // Just count and store - trees are already marked
        var total_competitors = stand.trees.load('markcompetitor=true');
        stand.setFlag('abe_param_totalCompetitors', total_competitors);
        console.log(`[MEGA-STP] Selection complete: ${total_competitors} competitors marked.`);
    }
};

MEGA_STP_ACTIVITIES['selectiveThinning_remove'] = {
    id: 'MegaSTP_SelectiveThinning_Remove',
    type: 'general',  // Use 'general', not 'scheduled'
    schedule: { signal: 'do_selectiveThinning_remove' },
    
    action: function() {
        var total_competitors = stand.flag('abe_param_totalCompetitors') || 0;
        var total_times = stand.flag('abe_param_times') || 1;
        var trees_per_step = Math.ceil(total_competitors / total_times);
        
        var remaining = stand.trees.load('markcompetitor=true');
        var to_remove = Math.min(trees_per_step, remaining);
        
        stand.trees.filterRandom(to_remove);
        var harvested = stand.trees.harvest();
        stand.trees.removeMarkedTrees();
        
        console.log(`[MEGA-STP] Removed ${harvested} of ${remaining} competitors.`);
    }
};
```

**Option 2: If You Need Initial Removal in Selection Phase**

If you want to remove some competitors immediately after selection (like in the simpler `selectiveThinning` function iland-model:71-129 ), you need to manually call `evaluate()`:

```javascript
onExecute: function() {
    // Manually trigger marking
    activity.evaluate(stand);
    console.log(`[MEGA-STP] Marking complete.`);
},

onExecuted: function() {
    // Now do initial removal
    var total_competitors = stand.trees.load('markcompetitor=true');
    // ... removal logic
}
```

## Why This Simplifies Everything

1. **No conflict between marking and removal** - they happen in separate activities
2. **Clear separation of concerns** - selection logic is in C++, removal logic is in JavaScript
3. **Proven pattern** - the library uses this successfully iland-model:267-274 
4. **Easier debugging** - you can verify marking worked before attempting removal

## Notes

The key insight from `selectiveThinningZ1Z2` is that it doesn't fight against the C++ execution flow - it works with it by letting the default behavior mark trees, then uses a separate activity for controlled removal. iland-model:234-309  This is much simpler than trying to override `onExecute` and manually calling `evaluate()`.

Wiki pages you might want to explore:
- [Forest Management (ABE) (edfm-tum/iland-model)](/wiki/edfm-tum/iland-model#6)
- [Management Library (edfm-tum/iland-model)](/wiki/edfm-tum/iland-model#6.4)
### Citations
**File:** src/abe-lib/thinning/selective.js (L71-129)
```javascript
    program["Selective_selector"] = {
        id: opts.id + '_selector',
        type: 'thinning',
        schedule: opts.schedule,	
        thinning: 'selection',
        N: opts.nTrees,
        NCompetitors: opts.nCompetitors, // total competitors! not per thinning event
        speciesSelectivity: opts.speciesSelectivity,
        ranking: opts.preferenceFunction,

        onSetup: function() { 
            lib.initStandObj(); // create an empty object as stand property
        },
    
        onEnter: function() {
            stand.obj.lib.selective_thinning_counter = 0;
        },

        onExit: function() {
            //lib.activityLog(opts.id + ' - thinning_selection done'); 
        },
        description: `Part of selective thinning - mark ${opts.nTrees} crop trees and ${opts.nCompetitors} competitors.`
    };

    program['Selective_repeater'] = lib.repeater({ 
        id: opts.id + '_repeater',
        schedule: opts.schedule,
        signal: opts.sendSignal,
        interval: opts.interval,
        count: opts.times 
    });

    program["Selective_remover"] = {
        id: opts.id + '_remover',
        type: 'general',
        schedule: { signal: opts.sendSignal },
        action: function() {
            if (stand.obj.lib.selective_thinning_counter == 0) {
                // first year. Save # of marked competitors
                const marked = stand.trees.load('markcompetitor=true');
                stand.setFlag('compN', marked);
                lib.dbg(`selectiveThinning: start removal phase. ${marked} trees marked for removal (Target was ${opts.nCompetitors*opts.nTrees}).`);
            }
            stand.obj.lib.selective_thinning_counter = stand.obj.lib.selective_thinning_counter + 1;
            var n = stand.flag('compN') / opts.times;

            stand.trees.load('markcompetitor=true');
            stand.trees.filterRandomExclude(n);
            const harvested = stand.trees.harvest();
            //lib.activityLog('thinning remove competitors'); 
            lib.dbg(`selectiveThinning: repeat ${stand.obj.lib.selective_thinning_counter}, removed ${harvested} trees.`);
        },
        description: `Part of selective thinning - remove selected competitors in ${opts.times} activies every ${opts.interval} years.`
    }

    if (opts.constraint !== undefined) program.constraint = opts.constraint;

    return program;
}
```
**File:** src/abe-lib/thinning/selective.js (L233-309)
```javascript
  
    const select_trees = {
        type: 'thinning',
        thinning: 'selection',
        id: opts.id + '_repeating',
        schedule: { signal: opts.sendSignalPeriode },	
        constraint: opts.constraint,
        N: opts.nTrees,
        NCompetitors: opts.nCompetitors, 
        speciesSelectivity: opts.speciesSelectivity,
        ranking: opts.preferenceFunction + ' * (height < 25)',
    
        onCreate: function(act) { 
            act.scheduled=false; /* this makes sure that evaluate is also called when invoked by a signal */ 
            console.log(`onCreate: ${opts.id}: `);
            printObj(this);
            console.log('---end---');							  
        },
    
        onEnter: function() {
            lib.dbg("Hello world");
            stand.obj.lib.selective_thinning_counter = 0;
        },
    
        onExecuted: function() {
            lib.dbg("Select trees in stand " + stand.id + " executed.");
			stand.stp.signal('selective_start_thinning');
            //lib.activityLog('thinning_selection'); 
        },
        description: `Selective thinning. Repeated ${opts.times} times every ${opts.interval} years.`
    };

    program["SelectiveZ1Z2_selector"] = select_trees;
  
    program['SelectiveZ1Z2_thinning_repeater'] = lib.repeater({ 
        id: opts.id + '_thinning_repeater',
        schedule: { signal: 'selective_start_thinning'},
        signal: 'selective_thinning_remove',
        interval: opts.interval,
        count: opts.times,
        block: opts.block,
    });
  
    const remove_trees = {
        type: 'general',
        id: opts.id + '_remove_trees',
        schedule: { signal: 'selective_thinning_remove'},
        action: function() {
            if (stand.obj.lib.selective_thinning_counter == 0) {
                // first year. Save # of marked competitors
                const marked = stand.trees.load('markcompetitor=true');
                stand.setFlag('compN', marked);
                lib.dbg(`selectiveThinning: start removal phase. ${marked} trees marked for removal.`);
            }
            
            lib.log("Year: " + Globals.year + ", selective thinning harvest");
      
            stand.obj.lib.selective_thinning_counter = stand.obj.lib.selective_thinning_counter + 1;
            var n = stand.flag('compN') / opts.times;
            var N_Competitors = stand.trees.load('markcompetitor=true');
      
            if ((N_Competitors - n) > 0) {
                stand.trees.filterRandomExclude(N_Competitors - n);
            };
      
            const harvested = stand.trees.harvest();
            //lib.activityLog('thinning remove competitors'); // details? target species?
            // stand.trees.removeMarkedTrees(); // ? necessary ??
            lib.dbg(`selectiveThinning: repeat ${stand.obj.lib.selective_thinning_counter}, removed ${harvested} trees.`);
        },
        description: `Selective thinning (every ${opts.times} years), that removes all trees above a target diameter ( ${opts.TargetDBH} cm)).`
    }
    program["SelectiveZ1Z2_remover"] = remove_trees;
  
    if (opts.constraint !== undefined) program.constraint = opts.constraint;
  
    return program;
```
**File:** src/abe/actthinning.cpp (L119-142)
```cpp
}

bool ActThinning::execute(FMStand *stand)
{
    if (stand->trace()) qCDebug(abe) << stand->context() << "execute  activity" << name() << ":" << type();
    if (!stand->currentFlags().isScheduled()) {
        // if scheduling is off for this thinning activity,
        // then we need to invoke this manually.
        evaluate(stand);
    }
    if (events().hasEvent(QStringLiteral("onExecute"))) {
        // switch off simulation mode
        stand->currentFlags().setDoSimulate(false);
        // execute this event
        bool result =  Activity::execute(stand);
        stand->currentFlags().setDoSimulate(true);
        return result;
    } else {
        // default behavior: process all marked trees (harvest / cut)
        if (stand->trace()) qCDebug(abe) << stand->context() << "activity" << name() << "remove all marked trees.";
        FMTreeList trees(stand);
        trees.removeMarkedTrees();
        return true;
    }
```
## Q10
would something like that work ? 

MEGA_STP_ACTIVITIES['selectiveThinning_select'] = {
    id: 'MegaSTP_SelectiveThinning_Select',
    type: 'thinning',
    thinning: 'selection',
    schedule: { signal: 'do_selectiveThinning_select' },

    N: function() { return stand.flag('abe_param_nTrees'); },
    NCompetitors: function() { return stand.flag('abe_param_nCompetitors'); },
    ranking: 'height',

    onExecute: function() {
        console.log(`\n[MEGA-STP - onExecute] SELECT phase for stand ${stand.id}.`);
        console.log(`    -> Parameters Read: N=${stand.flag('abe_param_nTrees')}, NCompetitors=${stand.flag('abe_param_nCompetitors')}`);
        
        // --- THIS IS THE CRITICAL FIX ---
        // Manually trigger the C++ marking algorithm (evaluateSelective -> markCropTrees).
        // The 'activity' variable is the JS proxy for the C++ activity object.
        console.log("    -> Manually calling activity.evaluate() to trigger C++ marking...");
        stand.activity.evaluate(stand); 
        // ---------------------------------

        console.log(`    -> C++ marking algorithm has finished.`);
    },

    onExecuted: function() {
        console.log(`[MEGA-STP - onExecuted] SELECT phase for stand ${stand.id}. Reporting results and performing initial removal.`);
        
        const marked_crop = stand.trees.load('markcrop=true');
        const marked_competitors = stand.trees.load('markcompetitor=true');
        
        console.log(`  -> RESULT: Found ${marked_crop} marked crop trees.`);
        console.log(`  -> RESULT: Found ${marked_competitors} marked competitors.`);
        
        if (marked_crop === 0) {
            console.error(`  -> ERROR: C++ algorithm marked ZERO crop trees!`);
        }
        
        // Continue with removal logic
        stand.setFlag('abe_param_totalCompetitors', marked_competitors);
        var total_times = stand.flag('abe_param_times') || 1;
        var fraction_to_remove = (total_times > 0) ? (1 / total_times) : 0;
        var trees_to_remove_this_step = Math.ceil(marked_competitors * fraction_to_remove);

        stand.trees.load('markcompetitor=true');
        stand.trees.filterRandom(trees_to_remove_this_step);
        var harvested_count = stand.trees.harvest();
        stand.trees.removeMarkedTrees();

        console.log(`  -> Initial removal: Harvested ${harvested_count} trees.`);
        
        stand.setFlag('abe_selective_thinning_initialized', true);
        stand.setFlag('abe_last_activity', 'MegaSTP_SelectiveThinning_Select');
        stand.setFlag('abe_last_activity_year', Globals.year);
    }
};

// The 'remove' activity is fine as is, but we add logging for completeness.
MEGA_STP_ACTIVITIES['selectiveThinning_remove'] = {
    id: 'MegaSTP_SelectiveThinning_Remove',
    type: 'scheduled',
    schedule: { signal: 'do_selectiveThinning_remove' },
    onEvaluate: function() { return true; },
    onExecute: function() {
        console.log(`\n[MEGA-STP - onExecute] REMOVE phase for stand ${stand.id}.`);
        var fraction_to_remove = stand.flag('abe_param_fraction_to_remove') || 0;
        var remaining_competitors = stand.trees.load('markcompetitor=true');
        console.log(`  -> Found ${remaining_competitors} remaining competitors.`);
        var trees_to_remove_this_step = Math.ceil(remaining_competitors * fraction_to_remove);
        stand.trees.filterRandom(trees_to_remove_this_step);
        var harvested_count = stand.trees.harvest();
        stand.trees.removeMarkedTrees();
        console.log(`  -> Subsequent removal: Harvested ${harvested_count} trees this step.`);
    },
    onExecuted: function() {
        console.log(`[MEGA-STP - onExecuted] REMOVE phase complete for stand ${stand.id}.`);
        stand.setFlag('abe_last_activity', 'MegaSTP_SelectiveThinning_Remove');
        stand.setFlag('abe_last_activity_year', Globals.year);
    }
};
### Answer
Looking at your code, you're asking whether manually calling `activity.evaluate(stand)` in `onExecute` will work for signal-triggered selective thinning activities. iland-model:121-143 

## Answer

**Almost, but there's a critical issue**: You're calling `stand.activity.evaluate(stand)`, but `stand.activity` doesn't exist in the JavaScript context. The correct reference is just `activity` (without `stand.`).

### The Fix

Change this line:
```javascript
stand.activity.evaluate(stand);  // ❌ Wrong
```

To:
```javascript
activity.evaluate(stand);  // ✅ Correct
```

The `activity` variable is automatically available in the JavaScript execution context when your `onExecute` handler runs, as it's set up by the script bridge. iland-model:346-387 

## Why This Approach Works

When you provide an `onExecute` handler for a signal-triggered thinning activity:

1. `ActThinning::execute()` checks `!stand->currentFlags().isScheduled()` → **true** (signal-triggered) iland-model:123-127 

2. It checks `events().hasEvent("onExecute")` → **true** (you provided one) iland-model:129-135 

3. It calls `Activity::execute(stand)` which runs your `onExecute`, **skipping** the `else` block that would have called both `evaluate()` and `removeMarkedTrees()` iland-model:136-141 

4. By manually calling `activity.evaluate(stand)` in your `onExecute`, you trigger the C++ `markCropTrees()` algorithm iland-model:488-494 

5. Then `onExecuted` fires afterward, and the marked trees are still present for you to manipulate

## Alternative: Simpler Library Pattern

However, I still recommend the simpler approach used in `selectiveThinningZ1Z2` - **don't provide `onExecute` at all**, and let the default behavior mark trees: iland-model:234-263 

```javascript
MEGA_STP_ACTIVITIES['selectiveThinning_select'] = {
    id: 'MegaSTP_SelectiveThinning_Select',
    type: 'thinning',
    thinning: 'selection',
    schedule: { signal: 'do_selectiveThinning_select' },
    
    N: function() { return stand.flag('abe_param_nTrees'); },
    NCompetitors: function() { return stand.flag('abe_param_nCompetitors'); },
    ranking: 'height',
    
    onCreate: function(act) { 
        act.scheduled = false; // Force signal-triggered path
    },
    
    onExecuted: function() {
        // Trees are already marked by C++ algorithm
        var total_competitors = stand.trees.load('markcompetitor=true');
        stand.setFlag('abe_param_totalCompetitors', total_competitors);
        console.log(`[MEGA-STP] Selection complete: ${total_competitors} competitors marked.`);
    }
};
```

Then handle **all** removal (including the first removal) in your separate `selectiveThinning_remove` activity. This is cleaner because:
- No need to manually call `evaluate()`
- Separation of concerns: selection in one activity, removal in another
- Matches the proven library pattern iland-model:412-437 

## Notes

Your `selectiveThinning_remove` activity looks correct and will work for phased removal of the remaining marked competitors.

Wiki pages you might want to explore:
- [Forest Management (ABE) (edfm-tum/iland-model)](/wiki/edfm-tum/iland-model#6)
- [Management Activities (edfm-tum/iland-model)](/wiki/edfm-tum/iland-model#6.2)
- [Management Library (edfm-tum/iland-model)](/wiki/edfm-tum/iland-model#6.4)
### Citations
**File:** src/abe/actthinning.cpp (L121-143)
```cpp
bool ActThinning::execute(FMStand *stand)
{
    if (stand->trace()) qCDebug(abe) << stand->context() << "execute  activity" << name() << ":" << type();
    if (!stand->currentFlags().isScheduled()) {
        // if scheduling is off for this thinning activity,
        // then we need to invoke this manually.
        evaluate(stand);
    }
    if (events().hasEvent(QStringLiteral("onExecute"))) {
        // switch off simulation mode
        stand->currentFlags().setDoSimulate(false);
        // execute this event
        bool result =  Activity::execute(stand);
        stand->currentFlags().setDoSimulate(true);
        return result;
    } else {
        // default behavior: process all marked trees (harvest / cut)
        if (stand->trace()) qCDebug(abe) << stand->context() << "activity" << name() << "remove all marked trees.";
        FMTreeList trees(stand);
        trees.removeMarkedTrees();
        return true;
    }

```
**File:** src/abe/actthinning.cpp (L488-494)
```cpp
bool ActThinning::evaluateSelective(FMStand *stand)
{
    QJSValue result = FMSTP::evaluateJS(mSelectiveThinning.speciesProb);
    bool selective_species = populateSpeciesSelectivity(result);

    markCropTrees(stand, selective_species);
    return true;
```
**File:** src/abe/fomescript.cpp (L346-387)
```cpp
QJSValue FomeScript::addAgent(QJSValue program, QString name)
{
    // first create an agenttype
    if (!addAgentType(program, name))
        return false;
    return addAgent(name, name);
}

/// force execution of an activity (outside of the usual execution context, e.g. for debugging)
bool FomeScript::runActivity(int stand_id, QString activity)
{
    // find stand
    FMStand *stand = ForestManagementEngine::instance()->stand(stand_id);
    if (!stand)
        return false;
    if (!stand->stp())
        return false;
    Activity *act = stand->stp()->activity(activity);
    if (!act)
        return false;
    // run the activity....
    qCDebug(abe) << "running activity" << activity << "for stand" << stand_id;
    return act->execute(stand);
}

bool FomeScript::runActivityEvaluate(int stand_id, QString activity)
{
    // find stand
    FMStand *stand = ForestManagementEngine::instance()->stand(stand_id);
    if (!stand)
        return false;
    if (!stand->stp())
        return false;
    Activity *act = stand->stp()->activity(activity);
    if (!act)
        return false;
    // run the activity....
    qCDebug(abe) << "running evaluate of activity" << activity << "for stand" << stand_id;
    return act->evaluate(stand);

}

```
**File:** src/abe-lib/thinning/selective.js (L234-263)
```javascript
    const select_trees = {
        type: 'thinning',
        thinning: 'selection',
        id: opts.id + '_repeating',
        schedule: { signal: opts.sendSignalPeriode },	
        constraint: opts.constraint,
        N: opts.nTrees,
        NCompetitors: opts.nCompetitors, 
        speciesSelectivity: opts.speciesSelectivity,
        ranking: opts.preferenceFunction + ' * (height < 25)',
    
        onCreate: function(act) { 
            act.scheduled=false; /* this makes sure that evaluate is also called when invoked by a signal */ 
            console.log(`onCreate: ${opts.id}: `);
            printObj(this);
            console.log('---end---');							  
        },
    
        onEnter: function() {
            lib.dbg("Hello world");
            stand.obj.lib.selective_thinning_counter = 0;
        },
    
        onExecuted: function() {
            lib.dbg("Select trees in stand " + stand.id + " executed.");
			stand.stp.signal('selective_start_thinning');
            //lib.activityLog('thinning_selection'); 
        },
        description: `Selective thinning. Repeated ${opts.times} times every ${opts.interval} years.`
    };
```
**File:** src/abe-lib/thinning/selective.js (L412-437)
```javascript
    program["Selective_remover"] = {
        id: opts.id + '_remover',
        type: 'general',
        schedule: { signal: 'selective_thinning_remove'},
        action: function() {
            if (stand.obj.lib.selective_thinning_counter == 0) {
                // first year. Save # of marked competitors
                const marked = stand.trees.load('markcompetitor=true');
                stand.setFlag('compN', marked);
                lib.dbg(`selectiveThinning: start removal phase. ${marked} trees marked for removal.`);
            }
            stand.obj.lib.selective_thinning_counter = stand.obj.lib.selective_thinning_counter + 1;
            var n = stand.flag('compN') / opts.times;


            lib.log("Year: " + Globals.year + ", selective thinning harvest");

            stand.trees.load('markcompetitor=true');
            stand.trees.filterRandomExclude(n);
            const harvested = stand.trees.harvest();
            //lib.activityLog('thinning remove competitors'); // details? target species?
            //stand.trees.removeMarkedTrees(); // ? necessary ??
            lib.dbg(`selectiveThinning: repeat ${stand.obj.lib.selective_thinning_counter}, removed ${harvested} trees.`);
        },
        description: `Selective thinning (every ${opts.times} years), that removes all trees above a target diameter ( ${opts.TargetDBH} cm)).`
    }
```
## Q11
iin the example in the abe-lib you mentionned the selectiveThinningZ1Z2 does it remove all marked tree in the first go or not ?
### Answer
You're asking whether the `selectiveThinningZ1Z2` function in the ABE library removes all marked competitor trees immediately after the initial selection, or if it spreads the removal across multiple phases.

## Answer

**No, `selectiveThinningZ1Z2` does NOT remove all marked trees in the first go.** It uses a phased removal approach spread across multiple thinning events. iland-model:276-304 

## How It Works

The removal is divided into `opts.times` separate harvest events (default is 3): iland-model:145-145 

1. **Initial Selection Phase**: The selection activity marks all crop trees and competitors at once iland-model:234-263 

2. **First Removal**: In the remover activity's first execution, it calculates how many competitors to remove per step: `var n = stand.flag('compN') / opts.times` iland-model:281-291 

3. **Subsequent Removals**: The `lib.repeater()` triggers the removal activity multiple times at `opts.interval` year intervals (default is 5 years) iland-model:267-274 

## Key Implementation Details

The removal logic uses `filterRandomExclude()` to keep a subset of competitors and remove the rest: iland-model:292-298 

```javascript
var n = stand.flag('compN') / opts.times;  // Trees to remove per step
var N_Competitors = stand.trees.load('markcompetitor=true');  // Remaining marked trees

if ((N_Competitors - n) > 0) {
    stand.trees.filterRandomExclude(N_Competitors - n);  // Keep (N_Competitors - n) trees
}

const harvested = stand.trees.harvest();  // Remove the filtered subset
```

This means if 120 competitors were marked and `times=3`, it removes approximately 40 trees per thinning event over 3 separate executions.

## Notes

The simpler `selectiveThinning` function (not Z1Z2) uses the same phased removal pattern iland-model:103-124 , so this is the standard approach in the library for selective thinning operations.

Wiki pages you might want to explore:
- [Forest Management (ABE) (edfm-tum/iland-model)](/wiki/edfm-tum/iland-model#6)
- [Management Library (edfm-tum/iland-model)](/wiki/edfm-tum/iland-model#6.4)
### Citations
**File:** src/abe-lib/thinning/selective.js (L103-124)
```javascript
    program["Selective_remover"] = {
        id: opts.id + '_remover',
        type: 'general',
        schedule: { signal: opts.sendSignal },
        action: function() {
            if (stand.obj.lib.selective_thinning_counter == 0) {
                // first year. Save # of marked competitors
                const marked = stand.trees.load('markcompetitor=true');
                stand.setFlag('compN', marked);
                lib.dbg(`selectiveThinning: start removal phase. ${marked} trees marked for removal (Target was ${opts.nCompetitors*opts.nTrees}).`);
            }
            stand.obj.lib.selective_thinning_counter = stand.obj.lib.selective_thinning_counter + 1;
            var n = stand.flag('compN') / opts.times;

            stand.trees.load('markcompetitor=true');
            stand.trees.filterRandomExclude(n);
            const harvested = stand.trees.harvest();
            //lib.activityLog('thinning remove competitors'); 
            lib.dbg(`selectiveThinning: repeat ${stand.obj.lib.selective_thinning_counter}, removed ${harvested} trees.`);
        },
        description: `Part of selective thinning - remove selected competitors in ${opts.times} activies every ${opts.interval} years.`
    }
```
**File:** src/abe-lib/thinning/selective.js (L145-145)
```javascript
        times: 3, // number of thinning activities for each marked crop tree
```
**File:** src/abe-lib/thinning/selective.js (L234-263)
```javascript
    const select_trees = {
        type: 'thinning',
        thinning: 'selection',
        id: opts.id + '_repeating',
        schedule: { signal: opts.sendSignalPeriode },	
        constraint: opts.constraint,
        N: opts.nTrees,
        NCompetitors: opts.nCompetitors, 
        speciesSelectivity: opts.speciesSelectivity,
        ranking: opts.preferenceFunction + ' * (height < 25)',
    
        onCreate: function(act) { 
            act.scheduled=false; /* this makes sure that evaluate is also called when invoked by a signal */ 
            console.log(`onCreate: ${opts.id}: `);
            printObj(this);
            console.log('---end---');							  
        },
    
        onEnter: function() {
            lib.dbg("Hello world");
            stand.obj.lib.selective_thinning_counter = 0;
        },
    
        onExecuted: function() {
            lib.dbg("Select trees in stand " + stand.id + " executed.");
			stand.stp.signal('selective_start_thinning');
            //lib.activityLog('thinning_selection'); 
        },
        description: `Selective thinning. Repeated ${opts.times} times every ${opts.interval} years.`
    };
```
**File:** src/abe-lib/thinning/selective.js (L267-274)
```javascript
    program['SelectiveZ1Z2_thinning_repeater'] = lib.repeater({ 
        id: opts.id + '_thinning_repeater',
        schedule: { signal: 'selective_start_thinning'},
        signal: 'selective_thinning_remove',
        interval: opts.interval,
        count: opts.times,
        block: opts.block,
    });
```
**File:** src/abe-lib/thinning/selective.js (L276-304)
```javascript
    const remove_trees = {
        type: 'general',
        id: opts.id + '_remove_trees',
        schedule: { signal: 'selective_thinning_remove'},
        action: function() {
            if (stand.obj.lib.selective_thinning_counter == 0) {
                // first year. Save # of marked competitors
                const marked = stand.trees.load('markcompetitor=true');
                stand.setFlag('compN', marked);
                lib.dbg(`selectiveThinning: start removal phase. ${marked} trees marked for removal.`);
            }
            
            lib.log("Year: " + Globals.year + ", selective thinning harvest");
      
            stand.obj.lib.selective_thinning_counter = stand.obj.lib.selective_thinning_counter + 1;
            var n = stand.flag('compN') / opts.times;
            var N_Competitors = stand.trees.load('markcompetitor=true');
      
            if ((N_Competitors - n) > 0) {
                stand.trees.filterRandomExclude(N_Competitors - n);
            };
      
            const harvested = stand.trees.harvest();
            //lib.activityLog('thinning remove competitors'); // details? target species?
            // stand.trees.removeMarkedTrees(); // ? necessary ??
            lib.dbg(`selectiveThinning: repeat ${stand.obj.lib.selective_thinning_counter}, removed ${harvested} trees.`);
        },
        description: `Selective thinning (every ${opts.times} years), that removes all trees above a target diameter ( ${opts.TargetDBH} cm)).`
    }
```
## Q12
Sorry to insist but can you return me your most likely working version of the STP
### Answer
You're asking for a working version of the signal-based selective thinning STP activities based on our entire conversation.<cite/>

# Answer

Here's the recommended implementation following the library pattern from `selectiveThinningZ1Z2`: iland-model:233-308 

## Selection Activity

```javascript
MEGA_STP_ACTIVITIES['selectiveThinning_select'] = {
    id: 'MegaSTP_SelectiveThinning_Select',
    type: 'thinning',
    thinning: 'selection',
    schedule: { signal: 'do_selectiveThinning_select' },
    
    // Dynamic parameters read from stand flags
    N: function() { return stand.flag('abe_param_nTrees'); },
    NCompetitors: function() { return stand.flag('abe_param_nCompetitors'); },
    ranking: 'height',
    
    // Force signal-triggered execution path
    onCreate: function(act) { 
        act.scheduled = false;
    },
    
    onExecuted: function() {
        // Trees are already marked by C++ algorithm
        var total_competitors = stand.trees.load('markcompetitor=true');
        stand.setFlag('abe_param_totalCompetitors', total_competitors);
        
        console.log(`[MEGA-STP] Selection complete for stand ${stand.id}: ${total_competitors} competitors marked.`);
        
        stand.setFlag('abe_last_activity', 'MegaSTP_SelectiveThinning_Select');
        stand.setFlag('abe_last_activity_year', Globals.year);
    }
};
```

## Removal Activity

```javascript
MEGA_STP_ACTIVITIES['selectiveThinning_remove'] = {
    id: 'MegaSTP_SelectiveThinning_Remove',
    type: 'general',
    schedule: { signal: 'do_selectiveThinning_remove' },
    
    action: function() {
        var total_competitors = stand.flag('abe_param_totalCompetitors') || 0;
        var total_times = stand.flag('abe_param_times') || 1;
        
        // Calculate trees to remove per step
        var trees_per_step = Math.ceil(total_competitors / total_times);
        
        // Load remaining marked competitors
        var remaining = stand.trees.load('markcompetitor=true');
        var to_remove = Math.min(trees_per_step, remaining);
        
        // Remove the calculated number
        stand.trees.filterRandom(to_remove);
        var harvested = stand.trees.harvest();
        stand.trees.removeMarkedTrees();
        
        console.log(`[MEGA-STP] Removed ${harvested} of ${remaining} competitors from stand ${stand.id}.`);
        
        stand.setFlag('abe_last_activity', 'MegaSTP_SelectiveThinning_Remove');
        stand.setFlag('abe_last_activity_year', Globals.year);
    }
};
```

## Critical Setup in Your Agent Code

```javascript
Action.trigger_activity = function(stand_data) {
    var stand = Globals.standById(stand_data.stand_id);
    
    // MUST set flags BEFORE sending signal
    stand.setFlag('abe_param_nTrees', stand_data.activity.parameters.nTrees);
    stand.setFlag('abe_param_nCompetitors', stand_data.activity.parameters.nCompetitors);
    stand.setFlag('abe_param_times', stand_data.activity.parameters.times || 1);
    
    // Now trigger the signal
    stand.stp.signal('do_selectiveThinning_select');
};
```

## Why This Works

1. **Selection activity** doesn't provide `onExecute`, so the default C++ behavior runs `evaluate()` to mark trees iland-model:134-140 

2. **`onCreate` with `act.scheduled=false`** forces the signal-triggered execution path, matching the library pattern iland-model:244-246 

3. **Removal activity** uses `type: 'general'` with an `action` function for full control over phased removal iland-model:276-303 

4. **Stand flags** are set before the signal fires, ensuring parameters are available when the C++ algorithm runs iland-model:47-67 

# Notes

This is the cleanest approach - it works with the C++ execution flow rather than fighting it, and matches the proven library implementation. Enable verbose logging with `fmengine.verbose = true` to see detailed marking output iland-model:641-644 .

Wiki pages you might want to explore:
- [Forest Management (ABE) (edfm-tum/iland-model)](/wiki/edfm-tum/iland-model#6)
- [Management Library (edfm-tum/iland-model)](/wiki/edfm-tum/iland-model#6.4)
### Citations
**File:** src/abe-lib/thinning/selective.js (L47-67)
```javascript
    // dynamic parameters of selective thinning
    function dynamic_nTrees() {
        // retrieve N from stand flag during runtime
        var value = stand.flag('nTrees');
        if (value === undefined) value = opts.nTrees;
        return value;
    };
    function dynamic_nCompetitors() {
        // retrieve N from stand flag during runtime
        //var value = stand.flag('nCompetitors');
        const Agefactor = Math.max(Math.min(1.0, -0.01*stand.age+1.2), 0.0);
        var value = Math.max(stand.flag('nCompetitors')*Agefactor, 1);
        if (value === undefined) value = opts.nCompetitors;
        return value;
    };

    // changing parameters if mode is dynamic
    if (opts.mode == 'dynamic') {
        opts.nTrees = dynamic_nTrees;
        opts.nCompetitors = dynamic_nCompetitors;
    };
```
**File:** src/abe-lib/thinning/selective.js (L233-308)
```javascript
  
    const select_trees = {
        type: 'thinning',
        thinning: 'selection',
        id: opts.id + '_repeating',
        schedule: { signal: opts.sendSignalPeriode },	
        constraint: opts.constraint,
        N: opts.nTrees,
        NCompetitors: opts.nCompetitors, 
        speciesSelectivity: opts.speciesSelectivity,
        ranking: opts.preferenceFunction + ' * (height < 25)',
    
        onCreate: function(act) { 
            act.scheduled=false; /* this makes sure that evaluate is also called when invoked by a signal */ 
            console.log(`onCreate: ${opts.id}: `);
            printObj(this);
            console.log('---end---');							  
        },
    
        onEnter: function() {
            lib.dbg("Hello world");
            stand.obj.lib.selective_thinning_counter = 0;
        },
    
        onExecuted: function() {
            lib.dbg("Select trees in stand " + stand.id + " executed.");
			stand.stp.signal('selective_start_thinning');
            //lib.activityLog('thinning_selection'); 
        },
        description: `Selective thinning. Repeated ${opts.times} times every ${opts.interval} years.`
    };

    program["SelectiveZ1Z2_selector"] = select_trees;
  
    program['SelectiveZ1Z2_thinning_repeater'] = lib.repeater({ 
        id: opts.id + '_thinning_repeater',
        schedule: { signal: 'selective_start_thinning'},
        signal: 'selective_thinning_remove',
        interval: opts.interval,
        count: opts.times,
        block: opts.block,
    });
  
    const remove_trees = {
        type: 'general',
        id: opts.id + '_remove_trees',
        schedule: { signal: 'selective_thinning_remove'},
        action: function() {
            if (stand.obj.lib.selective_thinning_counter == 0) {
                // first year. Save # of marked competitors
                const marked = stand.trees.load('markcompetitor=true');
                stand.setFlag('compN', marked);
                lib.dbg(`selectiveThinning: start removal phase. ${marked} trees marked for removal.`);
            }
            
            lib.log("Year: " + Globals.year + ", selective thinning harvest");
      
            stand.obj.lib.selective_thinning_counter = stand.obj.lib.selective_thinning_counter + 1;
            var n = stand.flag('compN') / opts.times;
            var N_Competitors = stand.trees.load('markcompetitor=true');
      
            if ((N_Competitors - n) > 0) {
                stand.trees.filterRandomExclude(N_Competitors - n);
            };
      
            const harvested = stand.trees.harvest();
            //lib.activityLog('thinning remove competitors'); // details? target species?
            // stand.trees.removeMarkedTrees(); // ? necessary ??
            lib.dbg(`selectiveThinning: repeat ${stand.obj.lib.selective_thinning_counter}, removed ${harvested} trees.`);
        },
        description: `Selective thinning (every ${opts.times} years), that removes all trees above a target diameter ( ${opts.TargetDBH} cm)).`
    }
    program["SelectiveZ1Z2_remover"] = remove_trees;
  
    if (opts.constraint !== undefined) program.constraint = opts.constraint;
  
```
## Q13
Important Caveat and Final Diagnosis

The abe-lib selectiveThinning (the simple one) and selectiveThinningZ1Z2 have a key difference. The simple version performs a phased removal, while the Z1Z2 version (which we are now emulating) performs a full removal of all marked competitors at once.

By adopting the onCreate: act.scheduled=false pattern without an onExecute handler, we are telling the C++ engine to do what it does by default: mark and remove ALL competitors in a single step.

This means:

    The selectiveThinning_select activity will now successfully mark and remove trees. You will see a change in stem count and volume in the following year.

    The selectiveThinning_remove activity will subsequently find 0 marked competitors because they were all removed in the first step.

This is a limitation of using the default C++ behavior. To achieve true phased removal with signals, the only path is the pure JavaScript implementation I proposed earlier, as it gives you full control over the marking and removal process.

However, this current solution will fix the "0 marked trees" bug and give you a working, albeit single-pulse, selective thinning. Please run this and confirm that trees are now being removed in Year 2.

is that correct ?
### Answer
You're asking whether the `selectiveThinningZ1Z2` pattern with `onCreate: act.scheduled=false` will result in **all** marked competitors being removed immediately in the selection phase, making the subsequent removal activity find zero trees.

## Answer

**No, this is incorrect.** The `selectiveThinningZ1Z2` pattern does **NOT** remove all competitors in the first step. iland-model:275-303 

## What Actually Happens

When you use `onCreate: function(act) { act.scheduled=false; }` without providing `onExecute`, here's the execution flow:

1. `ActThinning::execute()` is called iland-model:121-144 

2. The condition `!stand->currentFlags().isScheduled()` is **true** (because `act.scheduled=false`) iland-model:124-127 

3. It calls `evaluate(stand)` which marks the trees iland-model:127-127 

4. Since there's no `onExecute` handler, it enters the `else` block and calls `trees.removeMarkedTrees()` iland-model:136-141 

**However**, `removeMarkedTrees()` only removes trees that are marked **for harvest** (`markForHarvest(true)`), not trees that are simply marked as competitors (`markcompetitor=true`). iland-model:436-490 

The `markCropTrees()` algorithm marks competitors with a **flag** (`markcompetitor=true`), but does **not** call `markForHarvest()` on them. The competitors remain in the stand with their marking flags intact, ready for the removal activity to process them in phases.

## Proof from Library Code

Look at the `selectiveThinningZ1Z2` remover activity - it successfully loads marked competitors in subsequent executions: iland-model:281-298 

If all competitors were removed in the selection phase, this code would always find zero trees, but it doesn't - it performs phased removal over multiple years.

## Notes

Your concern would be valid if the C++ algorithm called `markForHarvest()` on competitors, but it only sets the `markcompetitor` flag. The default `removeMarkedTrees()` call in the selection activity is essentially a no-op for competitors, allowing them to persist for phased removal.

Wiki pages you might want to explore:
- [Forest Management (ABE) (edfm-tum/iland-model)](/wiki/edfm-tum/iland-model#6)
- [Management Library (edfm-tum/iland-model)](/wiki/edfm-tum/iland-model#6.4)
### Citations
**File:** src/abe-lib/thinning/selective.js (L275-303)
```javascript
  
    const remove_trees = {
        type: 'general',
        id: opts.id + '_remove_trees',
        schedule: { signal: 'selective_thinning_remove'},
        action: function() {
            if (stand.obj.lib.selective_thinning_counter == 0) {
                // first year. Save # of marked competitors
                const marked = stand.trees.load('markcompetitor=true');
                stand.setFlag('compN', marked);
                lib.dbg(`selectiveThinning: start removal phase. ${marked} trees marked for removal.`);
            }
            
            lib.log("Year: " + Globals.year + ", selective thinning harvest");
      
            stand.obj.lib.selective_thinning_counter = stand.obj.lib.selective_thinning_counter + 1;
            var n = stand.flag('compN') / opts.times;
            var N_Competitors = stand.trees.load('markcompetitor=true');
      
            if ((N_Competitors - n) > 0) {
                stand.trees.filterRandomExclude(N_Competitors - n);
            };
      
            const harvested = stand.trees.harvest();
            //lib.activityLog('thinning remove competitors'); // details? target species?
            // stand.trees.removeMarkedTrees(); // ? necessary ??
            lib.dbg(`selectiveThinning: repeat ${stand.obj.lib.selective_thinning_counter}, removed ${harvested} trees.`);
        },
        description: `Selective thinning (every ${opts.times} years), that removes all trees above a target diameter ( ${opts.TargetDBH} cm)).`
```
**File:** src/abe/actthinning.cpp (L121-144)
```cpp
bool ActThinning::execute(FMStand *stand)
{
    if (stand->trace()) qCDebug(abe) << stand->context() << "execute  activity" << name() << ":" << type();
    if (!stand->currentFlags().isScheduled()) {
        // if scheduling is off for this thinning activity,
        // then we need to invoke this manually.
        evaluate(stand);
    }
    if (events().hasEvent(QStringLiteral("onExecute"))) {
        // switch off simulation mode
        stand->currentFlags().setDoSimulate(false);
        // execute this event
        bool result =  Activity::execute(stand);
        stand->currentFlags().setDoSimulate(true);
        return result;
    } else {
        // default behavior: process all marked trees (harvest / cut)
        if (stand->trace()) qCDebug(abe) << stand->context() << "activity" << name() << "remove all marked trees.";
        FMTreeList trees(stand);
        trees.removeMarkedTrees();
        return true;
    }

}
```
**File:** src/abe/fmtreelist.cpp (L436-490)
```cpp
/** remove trees from a list and reduce the list.

  */
int FMTreeList::remove_trees(QString expression, double fraction, bool management)
{
    TreeWrapper tw;
    if (expression.isEmpty())
        expression="true";
    Expression expr(expression,&tw);
    expr.enableIncSum();
    int n = 0;
    QPair<Tree*, double> empty_tree(nullptr,0.);
    QVector<QPair<Tree*, double> >::iterator tp=mTrees.begin();
    try {
        for (;tp!=mTrees.end();++tp) {
            // we skip trees that are explicitly marked as
            // "NoHarvest".
            if (tp->first->isMarkedNoHarvest())
                continue;

            tw.setTree(tp->first);
            // if expression evaluates to true and if random number below threshold...
            if (expr.calculate(tw) && drandom() <=fraction) {
                // remove from system
                if (management) {
                    if (simulate()) {
                        tp->first->markForHarvest(true);
                        mStand->addScheduledHarvest(tp->first->volume());
                    } else {
                        tp->first->markForHarvest(true);
                        tp->first->remove(removeFoliage(), removeBranch(), removeStem()); // management with removal fractions
                    }
                } else {
                    if (simulate()) {
                        tp->first->markForCut(true);
                        tp->first->setDeathCutdown();
                        mStand->addScheduledHarvest(tp->first->volume());
                    } else {
                        tp->first->markForCut(true);
                        tp->first->setDeathCutdown();
                        tp->first->remove(); // kill
                    }
                }
                // remove from tree list
                *tp = empty_tree;
                n++;
            }
        }
        mTrees.removeAll(empty_tree);
    } catch(const IException &e) {
        qCWarning(abe) << "treelist: remove_trees: expression:" << expression << ", msg:" << e.message();
    }
    return n;

}
