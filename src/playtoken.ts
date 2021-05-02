/* eslint-disable */
import {ZERO_ADDRESS} from './utils';
import {Transfer} from '../generated/PlayToken_L2/PlayToken_L2_Contract';
import {handleOwner} from './shared';
import {Bytes} from '@graphprotocol/graph-ts';

// TODO inject, for now use alpha address
let CONQUEST_ADDRESS: Bytes = Bytes.fromHexString('0xac11b7660e03601e6c09c0f983dba4653f64647b') as Bytes;

export function handlePlayTokenTransfer(event: Transfer): void {
  if (!event.params.from.equals(ZERO_ADDRESS)) {
    let from = handleOwner(event.params.from);
    from.playTokenBalance = from.playTokenBalance.minus(event.params.value);
    from.save();
  }

  if (!event.params.to.equals(ZERO_ADDRESS)) {
    let to = handleOwner(event.params.to);
    to.playTokenBalance = to.playTokenBalance.plus(event.params.value);

    if (!event.params.from.equals(CONQUEST_ADDRESS)) {
      to.playTokenGiven = to.playTokenGiven.plus(event.params.value);
    }
    to.save();
  }
}
