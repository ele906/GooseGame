const POND_BLUES = ['#7babc7', '#7cb7cc', '#6fa3bf', '#80b5ca', '#7db2c8', '#6e9fb8', '#82b9cd', '#76a9c3'];

export class Pond {
    constructor(x, y, rx, ry) {
        this.x = x; this.y = y; this.rx = rx; this.ry = ry;
        this.color = POND_BLUES[Math.floor(Math.random() * POND_BLUES.length)];
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, this.rx, this.ry, 0, 0, Math.PI * 2);
        ctx.fill();
    }
}

// type can be: 'bush' | 'bush2' | 'bush3' | 'cactus' | 'palm' | 'snow' | 'snow2'
export class Bush {
    constructor(x, y, radius = 40, type = 'bush') {
        this.x = x; this.y = y; this.radius = radius; this.type = type;
    }

    contains(x, y) {
        const dx = x - this.x, dy = y - this.y;
        return Math.sqrt(dx * dx + dy * dy) <= this.radius;
    }

    draw(ctx, game) {
        const img = game?.images[this.type];
        if (img && img.complete && img.naturalWidth > 0) {
            const size = this.radius * 2;
            ctx.drawImage(img, this.x - this.radius, this.y - this.radius, size, size);
        } else {
            ctx.fillStyle = '#228B22';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#32CD32';
            ctx.beginPath();
            ctx.arc(this.x - 10, this.y - 10, 15, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(this.x + 10, this.y - 5, 12, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}
