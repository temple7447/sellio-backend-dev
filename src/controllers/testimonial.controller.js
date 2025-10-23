const chalk = require('chalk');
const testimonialService = require('../services/testimonial.service');

class TestimonialController {
    async createTestimonial(req, res) {
        try {
            const result = await testimonialService.createTestimonial(
                req.body,
                req.file
            );
            console.log(chalk.green(`✓ Testimonial created: ${result.data.customerName}`));
            res.status(201).json(result);
        } catch (error) {
            console.error(chalk.red('✗ Testimonial creation failed:', error));
            res.status(error.status || 400).json({
                success: false,
                message: error.message
            });
        }
    }

    async getPublicTestimonials(req, res) {
        try {
            const result = await testimonialService.getPublicTestimonials(req.query);
            console.log(chalk.green('✓ Public testimonials fetched successfully'));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Public testimonials fetch failed:', error));
            res.status(error.status || 500).json({
                success: false,
                message: error.message
            });
        }
    }

    async getAllTestimonials(req, res) {
        try {
            const result = await testimonialService.getAllTestimonials(req.query);
            console.log(chalk.green('✓ All testimonials fetched successfully'));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Testimonials fetch failed:', error));
            res.status(error.status || 500).json({
                success: false,
                message: error.message
            });
        }
    }

    async getTestimonialById(req, res) {
        try {
            const result = await testimonialService.getTestimonialById(req.params.id);
            console.log(chalk.green(`✓ Testimonial fetched: ${req.params.id}`));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Testimonial fetch failed:', error));
            res.status(error.status || 500).json({
                success: false,
                message: error.message
            });
        }
    }

    async updateTestimonial(req, res) {
        try {
            const result = await testimonialService.updateTestimonial(
                req.params.id,
                req.body,
                req.file
            );
            console.log(chalk.blue(`✓ Testimonial updated: ${result.data.customerName}`));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Testimonial update failed:', error));
            res.status(error.status || 400).json({
                success: false,
                message: error.message
            });
        }
    }

    async deleteTestimonial(req, res) {
        try {
            const result = await testimonialService.deleteTestimonial(req.params.id);
            console.log(chalk.yellow(`✓ Testimonial deleted: ${result.data.customerName}`));
            res.json(result);
        } catch (error) {
            console.error(chalk.red('✗ Testimonial deletion failed:', error));
            res.status(error.status || 500).json({
                success: false,
                message: error.message
            });
        }
    }

}

module.exports = new TestimonialController();
