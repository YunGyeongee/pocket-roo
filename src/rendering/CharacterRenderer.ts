import type { Fighter } from '../entities/Fighter';
import {
  BODY_DOWN,
  BODY_DOWN_OFFSET,
  CROWN,
  CROWN_COLORS,
  GLOVE,
  GLOVE_SIZE,
  HEADS,
  LAYER_OFFSETS,
  LEGS,
  PALETTE,
  SKINS,
  TORSO,
  type HeadKey,
  type LegsKey,
  type Skin,
  type Sprite,
} from './PixelAssets';

interface Point {
  x: number;
  y: number;
}

/** Everything needed to draw one frame of a kangaroo, in local coordinates facing right (y up is negative). */
export interface Pose {
  legs: LegsKey | 'down';
  /** Offset of torso and head from the neutral stance. */
  body: Point;
  head: HeadKey;
  /** Glove centers relative to the feet. */
  front: Point;
  back: Point;
  /** Whole-body vertical offset (hops, breathing, rising uppercut). */
  bob: number;
  /** Length of the tail swung out in front along the floor (tail sweep), 0 for none. */
  tailSweep: number;
  /** Wears the champion's crown. */
  crown: boolean;
  /** Draw as a white silhouette (the first frames of a hit). */
  flash: boolean;
  /** Half transparent (invulnerable: dodging or getting up). */
  ghost: boolean;
}

const REST = { front: { x: 11, y: -18 }, back: { x: 8, y: -21 } };
const GUARD = { front: { x: 10, y: -26 }, back: { x: 7, y: -28 } };
const CROUCH = { body: { x: 0, y: 5 }, front: { x: 11, y: -13 }, back: { x: 8, y: -16 } };
const PUNCH_WINDUP = { x: 8, y: -20 };
const PUNCH_EXTENDED = { x: 18, y: -24 };
const UPPERCUT_TOP = { x: 13, y: -41 };
const STRAIGHT_EXTENDED = { x: 23, y: -24 };
const HOP = [0, -1, -2, -1];
const HOP_FRAME_TIME = 0.07;
const BLINK_EVERY = 3.2;
const BLINK_TIME = 0.12;
const HIT_FLASH_TIME = 0.06;
const KO_FALL_TIME = 0.25;
const SWEEP_TAIL_LENGTH = 30;

function lerp(a: Point, b: Point, t: number): Point {
  const k = Math.max(0, Math.min(1, t));
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
}

/** Maps a fighter's state to a pose. Pure, so poses can be tuned without touching the drawing. */
export function poseFor(fighter: Fighter): Pose {
  const pose: Pose = {
    legs: 'stand',
    body: { x: 0, y: 0 },
    head: fighter.animTime % BLINK_EVERY < BLINK_TIME ? 'blink' : 'normal',
    front: REST.front,
    back: REST.back,
    bob: 0,
    tailSweep: 0,
    crown: false,
    flash: false,
    ghost: false,
  };
  const t = fighter.stateTime;

  switch (fighter.state) {
    case 'idle': {
      // Slow breathing: the upper body and gloves sink a pixel every other half second.
      const breath = Math.floor(fighter.animTime * 2) % 2;
      pose.body = { x: 0, y: breath };
      pose.front = { x: REST.front.x, y: REST.front.y + breath };
      pose.back = { x: REST.back.x, y: REST.back.y + breath };
      break;
    }
    case 'move':
      pose.bob = HOP[Math.floor(fighter.animTime / HOP_FRAME_TIME) % HOP.length];
      break;
    case 'crouch':
      crouchPose(pose);
      break;
    case 'getup':
      crouchPose(pose);
      pose.ghost = true;
      break;
    case 'jumpsquat':
      // Coiled on the tail, about to spring.
      crouchPose(pose);
      pose.body = { x: -1, y: 4 };
      break;
    case 'air':
      airPose(fighter, pose);
      break;
    case 'attack':
      attackPose(fighter, pose);
      break;
    case 'guard': {
      const shake = fighter.stun > 0 ? -1 : 0;
      if (fighter.crouching) {
        crouchPose(pose);
        pose.body = { x: -1 + shake, y: 5 };
        pose.front = { x: 9 + shake, y: -21 };
        pose.back = { x: 6 + shake, y: -23 };
      } else {
        pose.body = { x: -1 + shake, y: 0 };
        pose.front = { x: GUARD.front.x + shake, y: GUARD.front.y };
        pose.back = { x: GUARD.back.x + shake, y: GUARD.back.y };
      }
      break;
    }
    case 'dodge':
      pose.body = { x: -3, y: 2 };
      pose.front = { x: 7, y: -22 };
      pose.back = { x: 4, y: -24 };
      pose.ghost = fighter.invulnerable;
      break;
    case 'hit':
      hurtPose(pose, t);
      break;
    case 'knockdown':
    case 'knockout':
      if (fighter.y > 0 || t < KO_FALL_TIME) {
        hurtPose(pose, t);
        pose.body = { x: -5, y: 3 };
        pose.front = { x: 4, y: -14 };
        pose.back = { x: 0, y: -16 };
      } else {
        pose.legs = 'down';
        pose.front = { x: -4, y: -7 };
        pose.back = { x: 2, y: -6 };
      }
      break;
    case 'victory': {
      pose.head = 'happy';
      pose.crown = true;
      pose.bob = -Math.round(Math.abs(Math.sin(fighter.animTime * 7)) * 3);
      const pump = Math.floor(fighter.animTime * 3) % 2;
      pose.front = { x: 13, y: -37 - pump };
      pose.back = { x: 8, y: -17 };
      break;
    }
    case 'defeat':
      pose.legs = 'sit';
      pose.head = 'sad';
      pose.body = { x: -1, y: 5 };
      pose.front = { x: 9, y: -11 };
      pose.back = { x: 6, y: -12 };
      break;
  }
  return pose;
}

function crouchPose(pose: Pose): void {
  pose.legs = 'sit';
  pose.body = CROUCH.body;
  pose.front = CROUCH.front;
  pose.back = CROUCH.back;
}

function hurtPose(pose: Pose, t: number): void {
  pose.body = { x: -3, y: 1 };
  pose.head = 'hurt';
  pose.front = { x: 6, y: -16 };
  pose.back = { x: 2, y: -19 };
  pose.flash = t < HIT_FLASH_TIME;
}

function airPose(fighter: Fighter, pose: Pose): void {
  pose.legs = 'air';
  pose.body = { x: 0, y: 2 };
  pose.front = { x: 10, y: -19 };
  pose.back = { x: 7, y: -24 };
  const attack = fighter.attack;
  if (!attack || attack.phase === 'startup') return;
  if (attack.kind === 'jumpKick') {
    pose.legs = 'kick';
    pose.body = { x: -3, y: 0 };
    pose.front = { x: 4, y: -26 };
    pose.back = { x: 1, y: -28 };
  } else {
    // Hammer punch down and forward.
    pose.front = { x: 17, y: -15 };
  }
}

/** Each attack splits into wind-up (startup), strike (active) and pulling back (recovery). */
function attackPose(fighter: Fighter, pose: Pose): void {
  const attack = fighter.attack;
  if (!attack) return;
  const { startup, active, recovery } = attack.spec;
  const phase = attack.phase;
  const windup = attack.elapsed / startup;
  const back = (attack.elapsed - startup - active) / recovery;

  switch (attack.kind) {
    case 'punch':
      pose.back = GUARD.back;
      if (phase === 'startup') {
        pose.front = lerp(REST.front, PUNCH_WINDUP, windup);
      } else if (phase === 'active') {
        pose.front = PUNCH_EXTENDED;
        pose.body = { x: 2, y: 0 };
      } else {
        pose.front = lerp(PUNCH_EXTENDED, REST.front, back);
        pose.body = { x: Math.round(2 * (1 - back)), y: 0 };
      }
      break;
    case 'kick':
      pose.front = { x: 7, y: -26 };
      pose.back = { x: 4, y: -28 };
      if (phase === 'startup') {
        // Rock back onto the tail.
        pose.body = { x: Math.round(-2 * windup), y: Math.round(windup) };
      } else if (phase === 'active' || back < 0.6) {
        pose.legs = 'kick';
        pose.body = { x: -3, y: 0 };
        pose.front = { x: 4, y: -26 };
        pose.back = { x: 1, y: -28 };
      }
      break;
    case 'lowJab': {
      crouchPose(pose);
      const extended = { x: 18, y: -9 };
      if (phase === 'startup') pose.front = lerp(CROUCH.front, { x: 8, y: -12 }, windup);
      else if (phase === 'active') pose.front = extended;
      else pose.front = lerp(extended, CROUCH.front, back);
      break;
    }
    case 'sweep': {
      crouchPose(pose);
      pose.legs = 'tuck';
      pose.body = { x: -2, y: 6 };
      pose.back = { x: 6, y: -20 };
      pose.front = { x: 9, y: -18 };
      // The tail swings around to the front, stays out, then pulls back.
      const reach = phase === 'startup' ? windup : phase === 'active' ? 1 : Math.max(0, 1 - back * 1.5);
      pose.tailSweep = Math.round(SWEEP_TAIL_LENGTH * reach);
      break;
    }
    case 'uppercut':
      pose.back = { x: 7, y: -25 };
      if (phase === 'startup') {
        crouchPose(pose);
        pose.body = { x: 0, y: 4 };
        pose.front = { x: 9, y: -11 };
      } else if (phase === 'active') {
        pose.bob = -4;
        pose.body = { x: 2, y: -2 };
        pose.front = UPPERCUT_TOP;
      } else {
        pose.bob = -Math.round(4 * (1 - back));
        pose.front = lerp(UPPERCUT_TOP, REST.front, back);
      }
      break;
    case 'straight':
      pose.back = GUARD.back;
      if (phase === 'startup') {
        pose.body = { x: -2, y: 1 };
        pose.front = lerp(REST.front, { x: 5, y: -21 }, windup);
      } else if (phase === 'active') {
        pose.body = { x: 4, y: 0 };
        pose.front = STRAIGHT_EXTENDED;
      } else {
        pose.body = { x: Math.round(4 * (1 - back)), y: 0 };
        pose.front = lerp(STRAIGHT_EXTENDED, REST.front, back);
      }
      break;
    case 'dropkick':
      if (phase === 'startup') {
        // Sit back onto the tail.
        crouchPose(pose);
        pose.body = { x: -2, y: 3 };
        pose.front = { x: 7, y: -19 };
        pose.back = { x: 5, y: -22 };
      } else if (phase === 'active' || back < 0.7) {
        pose.legs = 'dropkick';
        pose.body = { x: -4, y: -1 };
        pose.front = { x: 2, y: -28 };
        pose.back = { x: 0, y: -30 };
      }
      break;
    case 'jumpPunch':
    case 'jumpKick':
      break;
  }
}

/** Draws kangaroos from poses. All coordinates are logical pixels; the caller scales the result. */
export function drawFighter(ctx: CanvasRenderingContext2D, fighter: Fighter, groundY: number): void {
  const pose = poseFor(fighter);
  const skin = SKINS[fighter.side];
  const footX = Math.round(fighter.x);
  const footY = groundY - Math.round(fighter.y) + pose.bob;
  const facing = fighter.facing;

  ctx.save();
  if (pose.ghost) ctx.globalAlpha = 0.55;
  const paint = (sprite: Sprite, left: number, top: number, colors: Readonly<Record<string, string>> = skin): void =>
    drawSprite(ctx, sprite, footX, footY, left, top, facing, colors, pose.flash);
  const glove = (center: Point): void =>
    paint(GLOVE, Math.round(center.x) - GLOVE_SIZE / 2, Math.round(center.y) - GLOVE_SIZE / 2);

  if (pose.legs === 'down') {
    paint(BODY_DOWN, BODY_DOWN_OFFSET.x, BODY_DOWN_OFFSET.y);
    glove(pose.back);
    glove(pose.front);
    ctx.restore();
    return;
  }

  const legs = LAYER_OFFSETS.legs[pose.legs];
  paint(LEGS[pose.legs], legs.x, legs.y);
  if (pose.tailSweep > 0) {
    const tip = { x: -4 + pose.tailSweep, y: -2 };
    drawArm(ctx, footX, footY, facing, { x: -4, y: -3 }, tip, skin.k, skin.o);
    drawArm(ctx, footX, footY, facing, tip, tip, skin.k, skin.d);
  }
  const torso = { x: LAYER_OFFSETS.torso.x + pose.body.x, y: LAYER_OFFSETS.torso.y + pose.body.y };
  paint(TORSO, torso.x, torso.y);
  // Arms go under the head so a raised guard doesn't draw lines across the face; gloves go on top.
  const arm = (shoulder: Point, hand: Point, fur: keyof Skin): void => {
    const from = { x: torso.x + shoulder.x, y: torso.y + shoulder.y };
    drawArm(ctx, footX, footY, facing, from, hand, pose.flash ? PALETTE.white : skin.k, pose.flash ? PALETTE.white : skin[fur]);
  };
  arm(LAYER_OFFSETS.backShoulder, pose.back, 'd');
  arm(LAYER_OFFSETS.frontShoulder, pose.front, 'o');
  const head = { x: LAYER_OFFSETS.head.x + pose.body.x, y: LAYER_OFFSETS.head.y + pose.body.y };
  paint(HEADS[pose.head], head.x, head.y);
  if (pose.crown) paint(CROWN, head.x - 2, head.y - 5, CROWN_COLORS);
  glove(pose.back);
  glove(pose.front);
  ctx.restore();
}

function drawSprite(
  ctx: CanvasRenderingContext2D,
  sprite: Sprite,
  footX: number,
  footY: number,
  left: number,
  top: number,
  facing: 1 | -1,
  colors: Readonly<Record<string, string>>,
  flash: boolean,
): void {
  for (let row = 0; row < sprite.length; row++) {
    const line = sprite[row];
    for (let col = 0; col < line.length; col++) {
      const color = colors[line[col]];
      if (!color) continue;
      ctx.fillStyle = flash ? PALETTE.white : color;
      // Mirrored sprites flip around the feet.
      const localX = left + col;
      ctx.fillRect(facing === 1 ? footX + localX : footX - localX - 1, footY + top + row, 1, 1);
    }
  }
}

/** A short furry limb (arms, the swept tail): an outlined line between two points. */
function drawArm(
  ctx: CanvasRenderingContext2D,
  footX: number,
  footY: number,
  facing: 1 | -1,
  from: Point,
  to: Point,
  outline: string,
  fur: string,
): void {
  const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y)));
  const points: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const p = lerp(from, to, i / steps);
    const localX = Math.round(p.x);
    points.push({ x: facing === 1 ? footX + localX : footX - localX - 1, y: footY + Math.round(p.y) });
  }
  ctx.fillStyle = outline;
  for (const p of points) ctx.fillRect(p.x - 1, p.y - 1, 3, 3);
  ctx.fillStyle = fur;
  for (const p of points) ctx.fillRect(p.x, p.y, 1, 1);
}

/** Draws a sprite at a fixed spot, e.g. icons on the mode select cards. */
export function drawIcon(ctx: CanvasRenderingContext2D, sprite: Sprite, x: number, y: number, skin: Skin, scale = 1, mirrored = false): void {
  const width = Math.max(...sprite.map((line) => line.length));
  for (let row = 0; row < sprite.length; row++) {
    const line = sprite[row];
    for (let col = 0; col < line.length; col++) {
      const color = skin[line[col] as keyof Skin];
      if (!color) continue;
      ctx.fillStyle = color;
      const cx = mirrored ? width - 1 - col : col;
      ctx.fillRect(x + cx * scale, y + row * scale, scale, scale);
    }
  }
}
