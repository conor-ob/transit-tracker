# Frame

The enclosure for the Device: the standard frame from the upstream build guide ([Part 3: 3D Print Frame](https://transit-tracker.eastsideurbanism.org/docs/build-guide/print-frame)). It's printed in two identical halves, so print the same file twice. The halves are not mirror images; one is turned 180° against the other when assembled.

It comes in two versions. Pick one based on how well tuned your printer is:

- **Loose tolerances** give the LED matrix panels more room to fit inside the frame, but may leave visible gaps around the edge. Use this one if you're unsure.
- **Tight tolerances** fit more snugly, but only if your printer prints accurately.

| File | What it is |
| --- | --- |
| `loose-tolerances/transit-tracker-frame-upright.stl` | **Send this one to print** for the loose version. Already standing on its solid end (about 30 × 115 mm footprint, 202 mm tall), so it needs no supports. |
| `loose-tolerances/transit-tracker-frame.stl` | Loose version as downloaded from Printables, lying flat. |
| `loose-tolerances/transit-tracker-frame.step` | Loose version CAD source. |
| `tight-tolerances/transit-tracker-frame-tight-tolerances-upright.stl` | **Send this one to print** for the tight version. Standing on its solid end the same way (about 30 × 114 mm footprint, 202 mm tall). |
| `tight-tolerances/transit-tracker-frame-tight-tolerances.stl` | Tight version as downloaded from Printables, lying flat. |
| `tight-tolerances/transit-tracker-frame-tight-tolerances.step` | Tight version CAD source. |

Print in PLA with no supports and a brim. The rest of the slicer recommendations are in the [build guide](https://transit-tracker.eastsideurbanism.org/docs/build-guide/print-frame#recommendations). Assembly takes 12 × M3 × 8 mm machine screws ([Part 4: Assemble Frame](https://transit-tracker.eastsideurbanism.org/docs/build-guide/assemble-frame)).

## Licence

These files are not covered by the rest of this repository.

"[Transit Tracker Frame](https://www.printables.com/model/1332041-transit-tracker-frame)" by [tjhorner](https://www.printables.com/@tjhorner) is licensed under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). All `.stl` and `.step` files are unmodified, except the two `-upright.stl` files, which are the matching meshes rotated 90° and moved to sit on the build plate, and are shared under the same licence.
