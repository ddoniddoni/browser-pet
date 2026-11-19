import { expect, it } from 'vitest';
import { spriteFrame, validateDefinition, type PetDefinition, type SpriteClip } from '../../features/pet/definitions/sprite';

const placeholder: PetDefinition = {
  id: 'cat-default', displayName: '나비', defaultFacing: 'right', renderer: 'placeholder', clips: {}, fallbackAnimation: 'idle',
};
// 메모리 안의 테스트용 3열 2행 시트, 마지막 셀은 빈 칸이다.
const clip: SpriteClip = {
  path: 'pets/fixture.png', frameWidth: 32, frameHeight: 32, columns: 3, frameCount: 5, framesPerSecond: 8, loop: true,
};
const sheets = new Map([[clip.path, { width: 96, height: 64 }]]);
const definition = (walk: SpriteClip): PetDefinition => ({ ...placeholder, renderer: 'sprite', clips: { idle: clip, walk } });

it('임시 그림은 파일이 필요 없고, 실제 시트는 번들 목록 및 필수 모션을 확인한다', () => {
  expect(validateDefinition(placeholder, new Map())).toBe(true);
  expect(validateDefinition({ ...placeholder, renderer: 'sprite' }, sheets)).toBe(false);
  expect(validateDefinition(definition(clip), new Map())).toBe(false);
  expect(validateDefinition(definition(clip), sheets)).toBe(true);
});
it.each([{ columns: 2 }, { frameCount: 7 }, { frameWidth: 0 }, { frameHeight: 25 }, { framesPerSecond: Infinity }])(
  '잘못된 시트나 프레임 메타데이터를 거부한다 (%j)', change => {
    expect(validateDefinition(definition({ ...clip, ...change }), sheets)).toBe(false);
  });
it('마지막 프레임 뒤 빈 셀로 넘어가지 않고 반복 또는 정지한다', () => {
  expect(spriteFrame(clip, 4, 2)).toEqual({ x: -64, y: -64 });
  expect(spriteFrame(clip, 5, 2).x).toBeCloseTo(0);
  expect(spriteFrame({ ...clip, loop: false }, 6, 2)).toEqual({ x: -64, y: -64 });
});
