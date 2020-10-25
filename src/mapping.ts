import {store, Address, Bytes, BigInt, BigDecimal} from '@graphprotocol/graph-ts';
import {
  OuterSpaceContract,
  PlanetStake,
  FleetSent,
  FleetArrived,
  Attack,
} from '../generated/OuterSpace/OuterSpaceContract';
import {NamedEntity, AcquiredPlanet, AttackResult, Fleet, ReinforcementArrived} from '../generated/schema';
import {log} from '@graphprotocol/graph-ts';

const zeroAddress = '0x0000000000000000000000000000000000000000';

export function handlePlanetStake(event: PlanetStake): void {
  const id = event.params.location.toHex();
  let entity = AcquiredPlanet.load(id);
  if (!entity) {
    entity = new AcquiredPlanet(id);
  }
  entity.lastOwnershipTime = event.block.timestamp; // reset clock
  entity.owner = event.params.acquirer;
  // entity.location = event.params.location;
  entity.numSpaceships = event.params.numSpaceships;
  entity.lastUpdated = event.block.timestamp;
  entity.productionRate = event.params.productionRate;
  entity.stake = event.params.newStake;
  entity.save();
}

export function handleFleetSent(event: FleetSent): void {
  const id = event.params.fleet.toString();
  let entity = Fleet.load(id);
  if (!entity) {
    entity = new Fleet(id);
  }
  entity.owner = event.params.sender;
  entity.launchTime = event.block.timestamp;
  entity.from = event.params.from;
  entity.quantity = event.params.quantity;
  entity.save();
}

export function handleFleetArrived(event: FleetArrived): void {
  const id = event.params.fleet.toString();
  let entity = ReinforcementArrived.load(id);
  if (!entity) {
    entity = new ReinforcementArrived(id);
  }
  const fleetEntity = Fleet.load(id);
  entity.numSpaceships = fleetEntity.quantity;
  entity.timestamp = event.block.timestamp;
  entity.save();

  let planetEntity = AcquiredPlanet.load(id);
  if (!planetEntity) {
    planetEntity = new AcquiredPlanet(id);
    planetEntity.owner = fleetEntity.owner; // this should never happen, onwer can only be set in stake or attack
    planetEntity.lastOwnershipTime = event.block.timestamp; // TODO in contract (reset on stake ?)
  }
  planetEntity.numSpaceships = planetEntity.numSpaceships.plus(fleetEntity.quantity);
  planetEntity.save();

  store.remove('Fleet', id);
}

export function handleAttack(event: Attack): void {
  const id = event.params.fleet.toString();
  let entity = AttackResult.load(id);
  if (!entity) {
    entity = new AttackResult(id);
  }
  const fleetEntity = Fleet.load(id);
  entity.attackerLoss = event.params.fleetLoss;
  entity.defenderLoss = event.params.toLoss;
  entity.capture = event.params.won;
  entity.timestamp = event.block.timestamp;
  entity.save();

  let planetEntity = AcquiredPlanet.load(id);
  if (!planetEntity) {
    planetEntity = new AcquiredPlanet(id);
    planetEntity.owner = fleetEntity.owner;
    planetEntity.lastOwnershipTime = event.block.timestamp; // TODO in contract (reset on stake ?)
  }

  if (event.params.won) {
    planetEntity.numSpaceships = fleetEntity.quantity.minus(event.params.fleetLoss);
  } else {
    planetEntity.numSpaceships = planetEntity.numSpaceships.minus(event.params.toLoss);
  }
  planetEntity.save();

  store.remove('Fleet', id);
}
