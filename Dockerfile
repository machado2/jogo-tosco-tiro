# Build stage
FROM rust:1.75 as builder

# Install wasm32-unknown-unknown target
RUN rustup target add wasm32-unknown-unknown

# Install trunk
RUN cargo install --locked trunk

# Set working directory
WORKDIR /app

# Copy project files
COPY Cargo.toml Cargo.lock ./
COPY src ./src
COPY assets ./assets
COPY favicon.png ./

# Build the project with trunk in release mode
RUN trunk build --release

# Serve stage
FROM nginx:alpine

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Create custom nginx configuration
RUN echo 'server {' > /etc/nginx/conf.d/default.conf && \
    echo '    listen 80;' >> /etc/nginx/conf.d/default.conf && \
    echo '    server_name localhost;' >> /etc/nginx/conf.d/default.conf && \
    echo '    root /usr/share/nginx/html;' >> /etc/nginx/conf.d/default.conf && \
    echo '    index index.html;' >> /etc/nginx/conf.d/default.conf && \
    echo '' >> /etc/nginx/conf.d/default.conf && \
    echo '    location / {' >> /etc/nginx/conf.d/default.conf && \
    echo '        try_files $uri $uri/ /index.html;' >> /etc/nginx/conf.d/default.conf && \
    echo '    }' >> /etc/nginx/conf.d/default.conf && \
    echo '' >> /etc/nginx/conf.d/default.conf && \
    echo '    location ~ \.wasm$ {' >> /etc/nginx/conf.d/default.conf && \
    echo '        types { application/wasm wasm; }' >> /etc/nginx/conf.d/default.conf && \
    echo '        default_type application/wasm;' >> /etc/nginx/conf.d/default.conf && \
    echo '    }' >> /etc/nginx/conf.d/default.conf && \
    echo '' >> /etc/nginx/conf.d/default.conf && \
    echo '    location ~ \.js$ {' >> /etc/nginx/conf.d/default.conf && \
    echo '        types { application/javascript js; }' >> /etc/nginx/conf.d/default.conf && \
    echo '        default_type application/javascript;' >> /etc/nginx/conf.d/default.conf && \
    echo '    }' >> /etc/nginx/conf.d/default.conf && \
    echo '}' >> /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
