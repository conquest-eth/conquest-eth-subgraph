/* eslint-disable */
import {Address} from '@graphprotocol/graph-ts';
import {ZERO, toOwnerId} from './utils';
import {Owner} from '../generated/schema';

export function handleOwnerViaId(id: string): Owner {
  let entity = Owner.load(id);
  if (entity) {
    return entity as Owner;
  }
  entity = new Owner(id);
  entity.totalStaked = ZERO;
  entity.currentStake = ZERO;
  entity.totalCollected = ZERO;
  entity.playTokenToWithdraw = ZERO;
  entity.playTokenBalance = ZERO;
  entity.playTokenGiven = ZERO;
  entity.save();
  return entity as Owner;
}

export function handleOwner(address: Address): Owner {
  let id = toOwnerId(address);
  return handleOwnerViaId(id);
}
