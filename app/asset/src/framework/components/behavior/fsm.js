/**
 * Created by Maple on 8/11/15.
 */

/**
 * port from Javascript State Machine Library
 * https://github.com/jakesgordon/javascript-state-machine
 */
var FiniteStateMachine;

FiniteStateMachine = Component.extend({
    ctor: function () {
        this._super("FiniteStateMachine");
    },
    setupState: function (cfg) {
        cc.assert(typeof cfg == "object", "Invalid state config.");
        // allow for a simple string, or an object with { state: 'foo', event: 'setup', defer: true|false }
        if (typeof cfg["initial"] == "string") {
            this._initial = { state: cfg["initial"] }
        } else {
            this._initial = cfg["initial"];
        }
        this._terminal = cfg["terminal"] || cfg["final"];
        this._events = cfg["events"] || [];
        this._callbacks = cfg["callbacks"] || [];
        this._map = {}; // track state transitions allowed for an event { event: { from: [ to ] } }
        this._current = FiniteStateMachine.NONE_STATE;
        this._inTransition = false;

        // add the initial event if there is.
        if (this._initial) {
            this._initial["event"] = this._initial["event"] || FiniteStateMachine.STARTUP_EVENT;
            this._addEvent({
                name: this._initial["event"],
                from: FiniteStateMachine.NONE_STATE,
                to: this._initial["state"],
            });
        }

        // add the config events.
        for (var i = 0; i < this._events.length; ++i) {
            this._addEvent(this._events[i]);
        }

        // with no defer, do the initial event immediately.
        if (this._initial && !this._initial["defer"]) {
            this.doEvent(this._initial["event"]);
        }
    },
    isReady: function () {
        return this._current != "none";
    },
    getState: function () {
        return this._current;
    },
    isState: function (state) {
        if (state instanceof Array) {
            for (var i = 0; i < state.length; ++i) {
                if (state[i] == this._current) {
                    return true;
                }
            }
            return false;
        }
        return self._current == state;
    },
    canDoEvent: function (evt) {
        return !this._inTransition && (this._map[evt][this._current] || this._map[evt][FiniteStateMachine.WILD_CARD]);
    },
    cannotDoEvent: function (evt) {
        return !this.canDoEvent(evt);
    },
    isTerminalState: function () {
        return this.isState(this._terminal);
    },
    /**
     * force do event for the target, this will ignore the undefined operations.
     * @param evt eventName
     * @param ... extra arguments
     * @returns {Number}
     */
    doEventForce: function () {
        var evt = Array.prototype.shift.call(arguments);
        var args = Array.prototype.slice.call(arguments);

        var from = this._current;
        var map = this._map[evt];
        var to = (map[from] || map[FiniteStateMachine.WILD_CARD]) || from;

        var event = {
            name: evt,
            from: from,
            to: to,
            args: args,
        };

        if (this._inTransition) {
            this._inTransition = false;
        }
        this._beforeEvent(event);
        if (from == to) {
            this._afterEvent(event);
            return FiniteStateMachine.FSM_RESULT.NO_TRANSITION;
        }

        this._current = to;
        this._enterState(event);
        this._changeState(event);
        this._afterEvent(event);

        return FiniteStateMachine.FSM_RESULT.SUCCEEDED;
    },
    /**
     * do event for the target.
     * @param evt eventName
     * @param ... extra arguments
     * @returns {Number}
     */
    doEvent: function () {
        var evt = Array.prototype.shift.call(arguments);
        var args = Array.prototype.slice.call(arguments);

        cc.assert(this._map[evt], "Invalid event: " + evt);

        var from = this._current;
        var map = this._map[evt];
        var to = (map[from] || map[FiniteStateMachine.WILD_CARD]) || from;

        var event = {
            name: evt,
            from: from,
            to: to,
            args: args,
        };

        if (this._inTransition) {
            this._onError(event,
                FiniteStateMachine.FSM_ERROR.PENDING_TRANSITION,
                "event " + evt + " inappropriate because previous transition did not complete");
            return FiniteStateMachine.FSM_RESULT.FAILURE;
        }

        if (this.cannotDoEvent(evt)) {
            this._onError(event,
                FiniteStateMachine.FSM_ERROR.INVALID_TRANSITION,
                "event " + evt + " inappropriate in current state " + this._current);
            return FiniteStateMachine.FSM_RESULT.FAILURE;
        }

        // be aware of here, function "onbefore..." should return true/false to judge whether to cancel the event.
        if (this._beforeEvent(event) === false) {
            return FiniteStateMachine.FSM_RESULT.CANCELLED;
        }

        if (from == to) {
            this._afterEvent(event);
            return FiniteStateMachine.FSM_RESULT.NO_TRANSITION;
        }

        // this method should only be called once
        event.transition = function () {
            this._inTransition = false;
            this._current = to;
            this._enterState(event);
            this._changeState(event);
            this._afterEvent(event);
            return FiniteStateMachine.FSM_RESULT.SUCCEEDED;
        }.bind(this);
        // provide a way for caller to cancel async transition if desired
        event.cancel = function () {
            this._inTransition = false;
            event.transition = undefined;
            this._afterEvent(event);
        }.bind(this);

        this._inTransition = true;
        var leave = this._leaveState(event);
        if (leave === false) {
            // you can cancel the state in function "onleave..." by return false.
            event.transition = undefined;
            event.cancel = undefined;
            this._inTransition = false;
            return FiniteStateMachine.FSM_RESULT.CANCELLED;
        } else if (leave == FiniteStateMachine.ASYNC) {
            // you can mark async in function "onleave..." by return FiniteStateMachine.FSM_RESULT.PENDING until transition method is called.
            return FiniteStateMachine.FSM_RESULT.PENDING;
        } else {
            // need to check in case user manually called transition()
            // but forgot to return FiniteStateMachine.ASYNC
            if (event.transition) {
                event.transition();
            } else {
                this._inTransition = false;
            }
        }
    },
    onBind: function (target) {
    },
    onUnbind: function () {
    },
    _addEvent: function (evt) {
        var from = {};      // save the enabled 'from state' for the event.  { from1: true, from2: true, ... }
        if (evt["from"] instanceof Array) {
            for (var i = 0; i < evt["from"].length; ++i) {
                from[evt["from"][i]] = true;
            }
        } else if (evt["from"]) {
            from[evt["from"]] = true;
        } else {
            // allow "wildcard" transition if "from" is not specified.
            from[FiniteStateMachine.WILD_CARD] = true;
        }

        var eventName = evt["name"];
        this._map[eventName] = this._map[eventName] || {};
        var map = this._map[eventName];
        // allow no transition if "to" is not specified.
        for (var fromName in from) {
            map[fromName] = evt["to"] || fromName;
        }
    },
    _doCallback: function (callback, event) {
        if (callback) {
            return callback(event);
        }
    },
    _beforeAnyEvent: function (evt) {
        return this._doCallback(this._callbacks["onbeforeevent"], evt);
    },
    _afterAnyEvent: function (evt) {
        return this._doCallback(this._callbacks["onafterevent"] || this._callbacks["onevent"], evt);
    },
    _leaveAnyState: function (evt) {
        return this._doCallback(this._callbacks["onleavestate"], evt);
    },
    _enterAnyState: function (evt) {
        return this._doCallback(this._callbacks["onenterstate"] || this._callbacks["onstate"], evt);
    },
    _changeState: function (evt) {
        return this._doCallback(this._callbacks["onchangestate"], evt);
    },
    _beforeThisEvent: function (evt) {
        return this._doCallback(this._callbacks["onbefore" + evt["name"]], evt);
    },
    _afterThisEvent: function (evt) {
        return this._doCallback(this._callbacks["onafter" + evt["name"]] || this._callbacks["on" + evt["name"]], evt);
    },
    _leaveThisState: function (evt) {
        return this._doCallback(this._callbacks["onleave" + evt["from"]], evt);
    },
    _enterThisState: function (evt) {
        return this._doCallback(this._callbacks["onenter" + evt["to"]] || this._callbacks["on" + evt["to"]], evt);
    },
    _beforeEvent: function (evt) {
        if (this._beforeThisEvent(evt) === false || this._beforeAnyEvent(evt) === false) {
            return false;
        }
    },
    _afterEvent: function (evt) {
        this._afterThisEvent(evt);
        this._afterAnyEvent(evt);
    },
    _leaveState: function (evt, transition) {
        var specific = this._leaveThisState(evt, transition);
        var general = this._leaveAnyState(evt, transition);
        if (specific === false || general === false) {
            return false;
        } else if (specific == FiniteStateMachine.ASYNC || general == FiniteStateMachine.ASYNC) {
            return FiniteStateMachine.ASYNC;
        }
    },
    _enterState: function (evt) {
        this._enterThisState(evt);
        this._enterAnyState(evt);
    },
    _onError: function (evt, error, msg) {
        cc.log("[FiniteStateMachine] ERROR: error %s, event %s, from %s to %s", error.toString(), evt["name"], evt["from"], evt["to"]);
        mw.error(msg);
    },
    _initial: null,
    _terminal: null,
    _events: null,
    _callbacks: null,
    _map: null,
    _current: null,
    _inTransition: null,
});

// constants
FiniteStateMachine.FSM_RESULT = {
    SUCCEEDED: 1,   // the event transitioned successfully from one state to another
    NO_TRANSITION: 2,    // the event was successful but no state transition was necessary
    CANCELLED: 3,   // the event was cancelled by the caller in a beforeEvent callback
    PENDING: 4,  // the event is asynchronous and the caller is in control of when the transition occurs
    FAILURE: 5,     // the event is failed
};
FiniteStateMachine.FSM_ERROR = {
    INVALID_TRANSITION: 100, // caller tried to fire an event that was inappropriate in the current state
    PENDING_TRANSITION: 101, // caller tried to fire an event while an async transition was still pending
    INVALID_CALLBACK: 102,   // caller provided callback function threw an exception
};
FiniteStateMachine.WILD_CARD = "*";     // indicates any states will be ok
FiniteStateMachine.ASYNC = "async";
FiniteStateMachine.NONE_STATE = "none";
FiniteStateMachine.STARTUP_EVENT = "startup";