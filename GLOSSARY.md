# Transit Tracker

A deployment of the Transit Tracker API for Irish public transport, plus the customizations layered on top of it for our own departure boards.

## Language

**Device**:
A physical Transit Tracker display, running the stock firmware, that subscribes to the schedule for its Route-stop pairs.
_Avoid_: Board, departure board, tracker, display, sign

**Route-stop pair**:
A route at a particular stop, the unit a client asks upcoming trips for.
_Avoid_: Subscription, stop (on its own)

**Walk time**:
Seconds it takes to reach the stop for a Route-stop pair. Trips departing sooner than that are hidden, and the times shown stay real.
_Avoid_: Offset, walking offset, buffer

**Offset**:
Seconds taken off every trip's times for a Route-stop pair, so the Device shows when to leave rather than when the trip departs. Trips you'd have to leave for in the past are hidden. A Route-stop pair has an Offset or a Walk time, never both.
_Avoid_: Walk time (that keeps real times), time offset

**Direction**:
A route's GTFS `direction_id` (`0` or `1`), meaningful only together with that route.
_Avoid_: Headsign, platform, northbound/southbound

**Direction filter**:
A Direction attached to a Route-stop pair, limiting that pair to trips travelling in that Direction.
_Avoid_: Headsign filter, platform filter

**Route style**:
A route's colour and display name, set on the Device per route. It replaces the name upstream gives the route, not only its colour.
_Avoid_: Route colour rule, colour rule
