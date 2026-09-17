import { Quaternion, Vector3 } from './vendor/three.module.js';

const lateral = new Vector3(0,1,0);
const dorsal = new Vector3(0,0,1);
const spread = new Quaternion(), lift = new Quaternion();

// Rotate in the thorax frame BEFORE the source wing's folded rest rotation.
// Positive old local-Z flicks drove the already folded wing inward.
export function wingPose(rest, side, fraction, out = new Quaternion()) {
  spread.setFromAxisAngle(dorsal,-side*(.28+fraction*.25));
  lift.setFromAxisAngle(lateral,.21+fraction*.18);
  return out.copy(rest).premultiply(spread).premultiply(lift);
}
