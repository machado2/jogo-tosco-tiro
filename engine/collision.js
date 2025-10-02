// Collision engine using entity.body abstraction

function collides(a, b) {
    const aw = a.body ? a.body.width : a.width;
    const ah = a.body ? a.body.height : a.height;
    const ax = a.body ? a.body.x : a.x;
    const ay = a.body ? a.body.y : a.y;
    const bw = b.body ? b.body.width : b.width;
    const bh = b.body ? b.body.height : b.height;
    const bx = b.body ? b.body.x : b.x;
    const by = b.body ? b.body.y : b.y;
    const deltaX = Math.abs(ax - bx) - (aw / 2) - (bw / 2);
    const deltaY = Math.abs(ay - by) - (ah / 2) - (bh / 2);
    return (deltaX <= 0) && (deltaY <= 0);
}

function testCollision(a, b) {
    if (collides(a, b)) {
        const ea = a.energy;
        a.takeDamage(b.energy);
        b.takeDamage(ea);
        if (audioSystem && audioSystem.initialized) audioSystem.playImpact();
    }
}

function distributeHits(list1, list2) {
    for (let i = 0; i < list1.length; i++) {
        if (!list1[i].alive) continue;
        for (let j = 0; j < list2.length; j++) {
            if (!list2[j].alive) continue;
            testCollision(list1[i], list2[j]);
        }
    }
}

window.collides = collides;
window.testCollision = testCollision;
window.distributeHits = distributeHits;