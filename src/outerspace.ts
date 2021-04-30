/* eslint-disable */
import {Address, BigInt, Bytes} from '@graphprotocol/graph-ts';
import {flipHex, c2, ZERO, toPlanetId, toOwnerId, toFleetId, toEventId, toRewardId, ZERO_ADDRESS} from './utils';
import {handleOwner} from './shared';
import {
  PlanetStake,
  FleetSent,
  FleetArrived,
  StakeToWithdraw,
  PlanetExit,
  ExitComplete,
  RewardSetup,
  RewardToWithdraw,
} from '../generated/OuterSpace/OuterSpaceContract';
import {
  Planet,
  Fleet,
  FleetSentEvent,
  FleetArrivedEvent,
  PlanetExitEvent,
  Space,
  ExitCompleteEvent,
  StakeToWithdrawEvent,
  RewardSetupEvent,
  RewardToWithdrawEvent,
  Reward,
  PlanetStakeEvent,
} from '../generated/schema';
import {log} from '@graphprotocol/graph-ts';

function handleReward(rewardId: BigInt, ownerId: string, planetId: string): Reward {
  let id = toRewardId(rewardId);
  let entity = Reward.load(id);
  if (entity) {
    return entity as Reward;
  }
  entity = new Reward(id);
  entity.owner = ownerId;
  entity.planet = planetId;
  entity.withdrawn = false;
  entity.save();
  return entity as Reward;
}

let INITIAL_SPACE = BigInt.fromI32(16);
let EXPANSION = BigInt.fromI32(8);
let UINT32_MAX = BigInt.fromUnsignedBytes(Bytes.fromHexString('0xFFFFFFFF') as Bytes);
function handleSpaceChanges(planet: Planet): void {
  let space = Space.load('Space');
  if (space == null) {
    space = new Space('Space');
    space.minX = INITIAL_SPACE;
    space.maxX = INITIAL_SPACE;
    space.minY = INITIAL_SPACE;
    space.maxY = INITIAL_SPACE;
  }

  let x = planet.x;
  let y = planet.y;
  if (x.lt(ZERO)) {
    x = x.neg().plus(EXPANSION);
    if (x.gt(UINT32_MAX)) {
      x = UINT32_MAX;
    }
    if (space.minX.lt(x)) {
      space.minX = x;
    }
  } else {
    x = x.plus(EXPANSION);
    if (x.gt(UINT32_MAX)) {
      x = UINT32_MAX;
    }
    if (space.maxX.lt(x)) {
      space.maxX = x;
    }
  }

  if (y.lt(ZERO)) {
    y = y.neg().plus(EXPANSION);
    if (y.gt(UINT32_MAX)) {
      y = UINT32_MAX;
    }
    if (space.minY.lt(y)) {
      space.minY = y;
    }
  } else {
    y = y.plus(EXPANSION);
    if (y.gt(UINT32_MAX)) {
      y = UINT32_MAX;
    }
    if (space.maxY.lt(y)) {
      space.maxY = y;
    }
  }
  space.save();
}

function getOrCreatePlanet(id: string): Planet {
  let entity = Planet.load(id);
  if (entity != null) {
    return entity as Planet;
  }
  entity = new Planet(id);
  entity.firstAcquired = ZERO;
  entity.active = false;
  entity.numSpaceships = ZERO;
  entity.lastUpdated = ZERO;
  entity.exitTime = ZERO;
  entity.lastAcquired = ZERO;
  entity.reward = ZERO;

  let yString = id.slice(0, 34);
  let xString = '0x' + id.slice(34);

  let x = c2(xString);
  let absX = x.abs();
  let signX = x.lt(BigInt.fromI32(-32)) ? BigInt.fromI32(-1) : BigInt.fromI32(1);
  // log.error('(x,y): ({},{})', [xString, yString]);
  let centerZoneX = absX.plus(BigInt.fromI32(32)).div(BigInt.fromI32(64));
  let centerZoneXString = signX.equals(BigInt.fromI32(1))
    ? centerZoneX.toHex().slice(2).padStart(32, '0')
    : flipHex('0x' + centerZoneX.minus(BigInt.fromI32(1)).toHexString().slice(2).padStart(32, '0')).slice(2);

  let y = c2(yString);
  let absY = y.abs();
  let signY = y.lt(BigInt.fromI32(-32)) ? BigInt.fromI32(-1) : BigInt.fromI32(1);
  let centerZoneY = absY.plus(BigInt.fromI32(32)).div(BigInt.fromI32(64));
  let centerZoneYString = signY.equals(BigInt.fromI32(1))
    ? centerZoneY.toHex().slice(2).padStart(32, '0')
    : flipHex('0x' + centerZoneY.minus(BigInt.fromI32(1)).toHex().slice(2).padStart(32, '0')).slice(2);
  entity.zone = '0x' + centerZoneYString + centerZoneXString;

  // TODO remove :
  entity.x = x;
  entity.y = y;
  entity.zoneX = signX.equals(BigInt.fromI32(1)) ? centerZoneX : centerZoneX.neg();
  entity.zoneY = signY.equals(BigInt.fromI32(1)) ? centerZoneY : centerZoneY.neg();

  log.error('zone: {}', [entity.zone]);

  // entity.zone =
  //   BigInt.fromI32(-2).toHex() +
  //   '|||' +
  //   BigInt.fromI32(-1).toHex() +
  //   '|||' +
  //   '0x' +
  //   centerZoneX.toHexString().slice(2).padStart(32, '0') +
  //   centerZoneY.toHexString().slice(2).padStart(32, '0');
  return entity as Planet;
}

export function handlePlanetStake(event: PlanetStake): void {
  let id = toPlanetId(event.params.location);
  log.error('id: {}', [id]);
  let entity = getOrCreatePlanet(id);
  let owner = handleOwner(event.params.acquirer);
  owner.totalStaked = owner.totalStaked.plus(event.params.stake);
  owner.currentStake = owner.currentStake.plus(event.params.stake);
  owner.save();
  entity.owner = owner.id;
  entity.active = true;
  entity.numSpaceships = event.params.numSpaceships;
  entity.lastUpdated = event.block.timestamp;
  if (entity.firstAcquired.equals(ZERO)) {
    entity.firstAcquired = event.block.timestamp;
  }
  entity.lastAcquired = event.block.timestamp;
  entity.exitTime = ZERO;
  entity.stake = event.params.stake;
  entity.save();

  let planetStakeEvent = new PlanetStakeEvent(toEventId(event));
  planetStakeEvent.blockNumber = event.block.number.toI32();
  planetStakeEvent.timestamp = event.block.timestamp;
  planetStakeEvent.transactionID = event.transaction.hash;
  planetStakeEvent.owner = owner.id;
  planetStakeEvent.planet = entity.id;
  planetStakeEvent.numSpaceships = event.params.numSpaceships;
  planetStakeEvent.stake = event.params.stake;
  planetStakeEvent.save();

  handleSpaceChanges(entity);
}

export function handleFleetSent(event: FleetSent): void {
  let fleetId = toFleetId(event.params.fleet);
  // ---------------- LOG ----------------------------
  let existingFleet = Fleet.load(fleetId);
  if (existingFleet) {
    log.error('fleet already exist: {}', [fleetId]);
  }
  // --------------------------------------------------
  let fleetEntity = new Fleet(fleetId);
  let planetEntity = getOrCreatePlanet(toPlanetId(event.params.from)); // TODO should be created by now, should we error out if not ?
  planetEntity.numSpaceships = event.params.newNumSpaceships;
  planetEntity.lastUpdated = event.block.timestamp;
  planetEntity.save();
  let sender = handleOwner(event.params.fleetOwner);
  fleetEntity.owner = sender.id;
  fleetEntity.launchTime = event.block.timestamp;
  fleetEntity.from = planetEntity.id;
  fleetEntity.quantity = event.params.quantity;
  fleetEntity.save();
  let fleetSendEvent = new FleetSentEvent(toEventId(event));
  fleetSendEvent.blockNumber = event.block.number.toI32();
  fleetSendEvent.timestamp = event.block.timestamp;
  fleetSendEvent.transactionID = event.transaction.hash;
  fleetSendEvent.owner = sender.id;
  fleetSendEvent.planet = planetEntity.id;
  fleetSendEvent.fleet = fleetId;
  fleetSendEvent.newNumSpaceships = event.params.newNumSpaceships;
  fleetSendEvent.quantity = event.params.quantity;
  fleetSendEvent.save();
}

export function handleFleetArrived(event: FleetArrived): void {
  let fleetId = toFleetId(event.params.fleet);
  let planetId = toPlanetId(event.params.destination);
  let planetEntity = getOrCreatePlanet(planetId);
  let fleetEntity = Fleet.load(fleetId);
  let sender = handleOwner(event.params.fleetOwner);
  let destinationOwner = handleOwner(event.params.destinationOwner);

  planetEntity.numSpaceships = event.params.newNumspaceships;
  planetEntity.lastUpdated = event.block.timestamp;
  if (event.params.won) {
    planetEntity.owner = fleetEntity.owner;
    planetEntity.lastAcquired = event.block.timestamp;
    planetEntity.exitTime = ZERO; // disable exit on capture
  }

  planetEntity.save();

  let fleetArrivedEvent = new FleetArrivedEvent(toEventId(event));
  fleetArrivedEvent.blockNumber = event.block.number.toI32();
  fleetArrivedEvent.timestamp = event.block.timestamp;
  fleetArrivedEvent.transactionID = event.transaction.hash;
  fleetArrivedEvent.owner = sender.id;
  fleetArrivedEvent.planet = planetEntity.id;
  fleetArrivedEvent.fleet = fleetId;
  fleetArrivedEvent.destinationOwner = destinationOwner.id;
  fleetArrivedEvent.fleetLoss = event.params.fleetLoss;
  fleetArrivedEvent.planetLoss = event.params.planetLoss;
  fleetArrivedEvent.inFlightFleetLoss = event.params.inFlightFleetLoss;
  fleetArrivedEvent.inFlightPlanetLoss = event.params.inFlightPlanetLoss;
  fleetArrivedEvent.won = event.params.won;
  fleetArrivedEvent.newNumspaceships = event.params.newNumspaceships; // TODO rename

  // extra data
  fleetArrivedEvent.from = fleetEntity.from;
  fleetArrivedEvent.quantity = fleetEntity.quantity;
  fleetArrivedEvent.save();
}

export function handleExit(event: PlanetExit): void {
  let owner = handleOwner(event.params.owner);
  let planetId = toPlanetId(event.params.location);
  let planetEntity = Planet.load(planetId);
  if (!planetEntity) {
    log.error('planet never acquired: {}', [planetId]); // this should never happen, exit can only happen when acquired
    // will fails as all fields are not set
  }
  planetEntity.exitTime = event.block.timestamp;
  planetEntity.save();
  let planetExitEvent = new PlanetExitEvent(toEventId(event));
  planetExitEvent.blockNumber = event.block.number.toI32();
  planetExitEvent.timestamp = event.block.timestamp;
  planetExitEvent.transactionID = event.transaction.hash;
  planetExitEvent.owner = owner.id;
  planetExitEvent.planet = planetEntity.id;
  planetExitEvent.exitTime = event.block.timestamp;

  // extra data
  planetExitEvent.stake = planetEntity.stake as BigInt;
  // planetExitEvent.complete = 0; // exiting...
  // TODO associate that event to that planet so that later event can trigger its update
  // this works as there can only be one active exit per planet at a time
  planetExitEvent.save();
}

export function handleExitComplete(event: ExitComplete): void {
  let owner = handleOwner(event.params.owner);
  owner.totalCollected = owner.totalCollected.plus(event.params.stake);
  owner.currentStake = owner.currentStake.minus(event.params.stake);
  owner.save();
  let planetEntity = Planet.load(toPlanetId(event.params.location));
  planetEntity.active = false;
  planetEntity.owner = null;
  planetEntity.save();

  let exitCompleteEvent = new ExitCompleteEvent(toEventId(event));
  exitCompleteEvent.blockNumber = event.block.number.toI32();
  exitCompleteEvent.timestamp = event.block.timestamp;
  exitCompleteEvent.transactionID = event.transaction.hash;
  exitCompleteEvent.owner = owner.id;
  exitCompleteEvent.planet = planetEntity.id;
  exitCompleteEvent.stake = event.params.stake;
  exitCompleteEvent.save();
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function handleStakeToWithdraw(event: StakeToWithdraw): void {
  let owner = handleOwner(event.params.owner);
  owner.playTokenToWithdraw = event.params.newStake;
  owner.save();

  let stakeToWithdrawEvent = new StakeToWithdrawEvent(toEventId(event));
  stakeToWithdrawEvent.blockNumber = event.block.number.toI32();
  stakeToWithdrawEvent.timestamp = event.block.timestamp;
  stakeToWithdrawEvent.transactionID = event.transaction.hash;
  stakeToWithdrawEvent.owner = owner.id;
  stakeToWithdrawEvent.newStake = event.params.newStake;
  stakeToWithdrawEvent.save();
}

export function handleRewardSetup(event: RewardSetup): void {
  let planetId = toPlanetId(event.params.location);
  let planetEntity = getOrCreatePlanet(planetId);
  planetEntity.reward = event.params.rewardId;
  planetEntity.save();

  let rewardSetupEvent = new RewardSetupEvent(toEventId(event));
  rewardSetupEvent.blockNumber = event.block.number.toI32();
  rewardSetupEvent.timestamp = event.block.timestamp;
  rewardSetupEvent.transactionID = event.transaction.hash;
  rewardSetupEvent.planet = planetEntity.id;
  rewardSetupEvent.rewardId = event.params.rewardId;
  rewardSetupEvent.save();
}

export function handleRewardToWithdraw(event: RewardToWithdraw): void {
  let planetEntity = Planet.load(toPlanetId(event.params.location));
  planetEntity.reward = ZERO;
  planetEntity.save();

  let owner = handleOwner(event.params.owner);

  handleReward(event.params.rewardId, owner.id, planetEntity.id);

  let rewardToWithdrawEvent = new RewardToWithdrawEvent(toEventId(event));
  rewardToWithdrawEvent.blockNumber = event.block.number.toI32();
  rewardToWithdrawEvent.timestamp = event.block.timestamp;
  rewardToWithdrawEvent.transactionID = event.transaction.hash;
  rewardToWithdrawEvent.planet = planetEntity.id;
  rewardToWithdrawEvent.owner = owner.id;
  rewardToWithdrawEvent.rewardId = event.params.rewardId;
  rewardToWithdrawEvent.save();
}
