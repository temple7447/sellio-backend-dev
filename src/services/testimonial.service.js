const MarketTestimonial = require('../models/MarketTestimonial');
const { cloudinary } = require('../utils/cloudinary');

class TestimonialService {
    async createTestimonial(data, file) {
        try {
            let avatarUrl = null;

            // Upload avatar to cloudinary if provided
            if (file) {
                const result = await new Promise((resolve, reject) => {
                    const stream = cloudinary.uploader.upload_stream(
                        {
                            folder: 'testimonial_avatars',
                            transformation: [
                                { width: 200, height: 200, crop: 'fill' },
                                { quality: 'auto' }
                            ]
                        },
                        (error, result) => {
                            if (error) reject(error);
                            else resolve(result);
                        }
                    );
                    stream.end(file.buffer);
                });
                avatarUrl = result.secure_url;
            }

            const testimonial = new MarketTestimonial({
                customerName: data.customerName,
                roleBusiness: data.roleBusiness,
                testimonialContent: data.testimonialContent,
                rating: data.rating,
                customerAvatar: avatarUrl
            });

            await testimonial.save();
            return {
                success: true,
                message: 'Testimonial created successfully',
                data: testimonial
            };
        } catch (error) {
            throw {
                status: 400,
                message: error.message || 'Failed to create testimonial'
            };
        }
    }

    async getPublicTestimonials(query = {}) {
        try {
            const page = parseInt(query.page) || 1;
            const limit = parseInt(query.limit) || 10;
            const skip = (page - 1) * limit;

            const testimonials = await MarketTestimonial.find()
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit);

            const total = await MarketTestimonial.countDocuments();

            return {
                success: true,
                data: testimonials,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            throw {
                status: 500,
                message: error.message || 'Failed to fetch testimonials'
            };
        }
    }

    async getAllTestimonials(query = {}) {
        try {
            const page = parseInt(query.page) || 1;
            const limit = parseInt(query.limit) || 10;
            const skip = (page - 1) * limit;

            const testimonials = await MarketTestimonial.find()
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit);

            const total = await MarketTestimonial.countDocuments();

            return {
                success: true,
                data: testimonials,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            throw {
                status: 500,
                message: error.message || 'Failed to fetch testimonials'
            };
        }
    }

    async getTestimonialById(id) {
        try {
            const testimonial = await MarketTestimonial.findById(id);
            
            if (!testimonial) {
                throw {
                    status: 404,
                    message: 'Testimonial not found'
                };
            }

            return {
                success: true,
                data: testimonial
            };
        } catch (error) {
            throw {
                status: error.status || 500,
                message: error.message || 'Failed to fetch testimonial'
            };
        }
    }

    async updateTestimonial(id, data, file) {
        try {
            const testimonial = await MarketTestimonial.findById(id);
            
            if (!testimonial) {
                throw {
                    status: 404,
                    message: 'Testimonial not found'
                };
            }

            // Upload new avatar if provided
            if (file) {
                const result = await new Promise((resolve, reject) => {
                    const stream = cloudinary.uploader.upload_stream(
                        {
                            folder: 'testimonial_avatars',
                            transformation: [
                                { width: 200, height: 200, crop: 'fill' },
                                { quality: 'auto' }
                            ]
                        },
                        (error, result) => {
                            if (error) reject(error);
                            else resolve(result);
                        }
                    );
                    stream.end(file.buffer);
                });
                data.customerAvatar = result.secure_url;
            }

            // Update fields
            Object.keys(data).forEach(key => {
                if (data[key] !== undefined) {
                    testimonial[key] = data[key];
                }
            });

            await testimonial.save();

            return {
                success: true,
                message: 'Testimonial updated successfully',
                data: testimonial
            };
        } catch (error) {
            throw {
                status: error.status || 400,
                message: error.message || 'Failed to update testimonial'
            };
        }
    }

    async deleteTestimonial(id) {
        try {
            const testimonial = await MarketTestimonial.findById(id);
            
            if (!testimonial) {
                throw {
                    status: 404,
                    message: 'Testimonial not found'
                };
            }

            await MarketTestimonial.findByIdAndDelete(id);

            return {
                success: true,
                message: 'Testimonial deleted successfully',
                data: testimonial
            };
        } catch (error) {
            throw {
                status: error.status || 500,
                message: error.message || 'Failed to delete testimonial'
            };
        }
    }

}

module.exports = new TestimonialService();
