var OPERATE = {
    PROPS: 1,
    INSERT: 2,
    REMOVE: 3,
    ORDER: 4
};

function _isObject(o) {
    return typeof o === 'object';
}

function _isArray(o) {
    return Object.prototype.toString.call(o) === '[object Array]';
}

function _remove(arr, index, key) {
  arr.splice(index, 1);

  return {
    from: index,
    key: key
  };
}

function _diffProps(a, b, ignore) {
    var key, aVal, bVal, diff;

    for (key in a) {
        // ignore the key
        if (ignore && ignore(key)) continue;

        if (!(key in b)) {
            diff = diff || {};
            diff[key] = undefined;
            continue;
        }

        aVal = a[key];
        bVal = b[key];

        if (aVal === bVal) {
            continue;
        } else if (_isObject(aVal) && _isObject(bVal)) {
            var objectDiff = _diffProps(aVal, bVal, ignore);
            if (objectDiff) {
                diff = diff || {};
                diff[key] = objectDiff;
            }
        } else {
            diff = diff || {};
            diff[key] = bVal;
        }
    }

    for (key in b) {
        // ignore the key
        if (ignore && ignore(key)) continue;

        if (!(key in a)) {
            diff = diff || {};
            diff[key] = b[key];
        }
    }

    return diff;
}

function _keyIndex(arr) {
  var keys = {}
    , free = []
    , length = arr.length
    , i = 0
    , item;

  for (; i < length; i++) {
    item = arr[i];

    if (item.key) {
      keys[item.key] = i;
    } else {
      free.push(i);
    }
  }

  return {
    keys: keys,     // A hash of key name to index
    free: free     // An array of unkeyed item indices
  };
}

function reorder(a, b) {
    // O(M) time, O(M) memory
    var bIndex = _keyIndex(b),
        bKeys = bIndex.keys,
        bFree = bIndex.free;
  
    if (bFree.length === b.length) {
        return {
            array: b,
            moves: null
        };
    }

    // O(N) time, O(N) memory
    var aIndex = _keyIndex(a),
        aKeys = aIndex.keys,
        aFree = aIndex.free;

    if (aFree.length === a.length) {
        return {
            array: b,
            moves: null
        };
    }

    // O(MAX(N, M)) memory
    var newArray = [],
        freeIndex = 0,
        freeCount = bFree.length,
        deletedItems = 0,
        aItem,
        itemIndex,
        i = 0,
        l = a.length;

    // O(N) time,
    for (; i < l; i++) {
        aItem = a[i];

        if (aItem.key) {
            if (bKeys.hasOwnProperty(aItem.key)) {
                // Match up the old keys
                itemIndex = bKeys[aItem.key];
                newArray.push(b[itemIndex]);
            } else {
                // Remove old keyed items
                itemIndex = i - deletedItems++;
                newArray.push(null);
            }
        } else {
            // Match the item in a with the next free item in b
            if (freeIndex < freeCount) {
                itemIndex = bFree[freeIndex++];
                newArray.push(b[itemIndex]);
            } else {
                // There are no free items in b to match with
                // the free items in a, so the extra free nodes
                // are deleted.
                itemIndex = i - deletedItems++;
                newArray.push(null);
            }
        }
    }

    var lastFreeIndex = freeIndex >= bFree.length ?
            b.length :
            bFree[freeIndex],
        j = 0,
        newItem;

    l = b.length;

    // Iterate through b and append any new keys
    // O(M) time
    for (; j < l; j++) {
        newItem = b[j];

        if (newItem.key) {
            if (!aKeys.hasOwnProperty(newItem.key)) {
                // Add any new keyed items
                // We are adding new items to the end and then sorting them
                // in place. In future we should insert new items in place.
                newArray.push(newItem);
            }
        } else if (j >= lastFreeIndex) {
            // Add any leftover non-keyed items
            newArray.push(newItem);
        }
    }

    var simulate = newArray.slice(),
        simulateIndex = 0,
        removes = [],
        inserts = [],
        simulateItem,
        wantedItem,
        k = 0;

    for (; k < l;) {
        wantedItem = b[k];
        simulateItem = simulate[simulateIndex];

        // remove items
        while (simulateItem === null && simulate.length) {
            removes.push(_remove(simulate, simulateIndex, null));
            simulateItem = simulate[simulateIndex];
        }

        if (!simulateItem || simulateItem.key !== wantedItem.key) {
            // if we need a key in this position...
            if (wantedItem.key) {
                if (simulateItem && simulateItem.key) {
                    // if an insert doesn't put this key in place, it needs to move
                    if (bKeys[simulateItem.key] !== k + 1) {
                        removes.push(_remove(simulate, simulateIndex, simulateItem.key));
                        simulateItem = simulate[simulateIndex];
                        // if the remove didn't put the wanted item in place, we need to insert it
                        if (!simulateItem || simulateItem.key !== wantedItem.key) {
                          inserts.push({key: wantedItem.key, to: k});
                        // items are matching, so skip ahead
                        } else {
                            simulateIndex++;
                        }
                    } else {
                        inserts.push({key: wantedItem.key, to: k});
                    }
                } else {
                    inserts.push({key: wantedItem.key, to: k});
                }
                k++;
            } else if (simulateItem && simulateItem.key) {
                removes.push(_remove(simulate, simulateIndex, simulateItem.key));
            }
        } else {
            simulateIndex++;
            k++;
        }
    }

    // remove all the remaining items from simulate
    while (simulateIndex < simulate.length) {
        simulateItem = simulate[simulateIndex];
        removes.push(_remove(simulate, simulateIndex, simulateItem && simulateItem.key));
    }

    // If the only moves we have are deletes then we can just
    // let the delete patch remove these items.
    if (removes.length === deletedItems && !inserts.length) {
        return {
            array: newArray,
            moves: null
        };
    }

    return {
        array: newArray,
        moves: {
            removes: removes,
            inserts: inserts
        }
    }

}

function _diffArray(a, b, options, patches, prop) {
    var orderSet = reorder(a, b),
        b = orderSet.array,
        aLen = a.length,
        bLen = b.length,
        len = aLen > bLen ? aLen : bLen,
        i = 0,
        leftItem,
        rightItem;

    for (var i = 0; i < len; i++) {
        leftItem = a[i];
        rightItem = b[i];

        if (!leftItem) {
            if (rightItem) {
                patches.push({
                    from: rightItem,
                    to: prop,
                    operate: OPERATE.INSERT
                });
            }
        } else {
            var newProp = prop ?
                [prop, i].join('.') :
                i + ''
            walk(leftItem, rightItem, options, patches, newProp);
        }
    }

    if (orderSet.moves) {
        patches.push({
            operate: OPERATE.ORDER,
            from: orderSet.moves,
            to: prop
        });
    }

    return patches;
}

function walk(a, b, options, patches, prop) {
    patches = patches || [];
    var isArray = options.isArray || _isArray;

    // array like object
    if (b == null) {
        patches.push({
            from: prop,
            operate: OPERATE.REMOVE
        });
    } else if (isArray(a)) {
        _diffArray(a, b, options, patches, prop);
    // plain object
    } else {
        var diff = _diffProps(a, b, options.ignore);
        if (diff) {
            patches.push({
                diff: diff,
                operate: OPERATE.PROPS,
                from: prop
            })
        }
    }

    return patches;
}


function Diff(options) {
    this._init(options);
}
var p = Diff.prototype;
p._init = function (options) {
    this.options = options || {};
}
p.diff = function (old, cur) {
    return walk(old, cur, this.options);
};

module.exports = function (options) {
    return new Diff(options)
}