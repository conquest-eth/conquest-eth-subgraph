/* eslint-disable */
import {store, BigInt, Address} from '@graphprotocol/graph-ts';
import {flipHex, c2, ZERO, ZERO_ADDRESS, toPlanetId, toOwnerId, toFleetId, toEventId} from './utils';
import {
  PlanetStake,
  FleetSent,
  FleetArrived,
  StakeToWithdraw,
  PlanetExit,
} from '../generated/OuterSpace/OuterSpaceContract';
import {Planet, Fleet, Owner, FleetSentEvent, FleetArrivedEvent, PlanetExitEvent} from '../generated/schema';
import {log} from '@graphprotocol/graph-ts';

function getOrCreatePlanet(id: string): Planet {
  let entity = Planet.load(id);
  if (entity) {
    return entity as Planet;
  }
  entity = new Planet(id);
  entity.firstAcquired = ZERO;

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

function handleOwner(address: Address): Owner {
  let id = toOwnerId(address);
  let entity = Owner.load(id);
  if (entity) {
    return entity as Owner;
  }
  entity = new Owner(id);
  entity.save();
  return entity as Owner;
}

export function handlePlanetStake(event: PlanetStake): void {
  let id = toPlanetId(event.params.location);
  log.error('id: {}', [id]);
  let entity = getOrCreatePlanet(id);
  let owner = handleOwner(event.params.acquirer);
  entity.owner = owner.id;
  entity.numSpaceships = event.params.numSpaceships;
  entity.lastUpdated = event.block.timestamp;
  if (entity.firstAcquired.equals(ZERO)) {
    entity.firstAcquired = event.block.timestamp;
  }
  entity.lastAcquired = event.block.timestamp;
  entity.exitTime = ZERO;
  entity.save();
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
  // TODO handle sending to empty planets
  if (event.params.fleetLoss.equals(ZERO) && event.params.planetLoss.equals(ZERO) && !event.params.won) {
    // reinforcement
    planetEntity.numSpaceships = event.params.newNumspaceships;
    planetEntity.lastUpdated = event.block.timestamp;
    planetEntity.save();
  } else {
    // capture

    if (event.params.won) {
      planetEntity.owner = fleetEntity.owner;
      planetEntity.exitTime = ZERO; // disable exit on capture
    }
    planetEntity.numSpaceships = event.params.newNumspaceships;
    planetEntity.lastUpdated = event.block.timestamp;
    planetEntity.lastAcquired = event.block.timestamp;
    planetEntity.save();
  }

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
  planetExitEvent.save();
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function handleStakeToWithdraw(event: StakeToWithdraw): void {
  // TODO Stake
}
